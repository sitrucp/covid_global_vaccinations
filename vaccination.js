
// get files from OWID github repository
// to do: use stable url instead
// https://covid.ourworldindata.org/data/vaccinations/vaccinations.csv
var file_update_time = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/owid-covid-data-last-updated-timestamp.txt";
var file_vaccinations = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/vaccinations/vaccinations.csv";
var file_population = "https://raw.githubusercontent.com/owid/COVID-19-data/master/scripts/input/un/population_2020.csv";

// define color variables
var clrBlue = 'rgba(49,130,189,.9)';
var clrGray = 'rgba(204,204,204,.9)';
var clrBlack = 'rgba(0,0,0,.9)';
var clrWhiteTransparent = 'rgba(255,255,255,0)';

// define default filter variables
var selCountry = 'Canada';
var selCountryGroup = 'all'
var selCountryPop = 'all'

// get data (with filters, if any)
getData(selCountry, selCountryGroup, selCountryPop);

function getData(selCountry, selCountryGroup, selCountryPop){
    // promise data from sources
    Promise.all([
        d3.csv(file_vaccinations),
        d3.csv(file_population),
        d3.csv(file_update_time),
    ]).then(function(data) {
        //everthing else below is in promise scope

        // get data from promise
        var arrVaccinations = data[0];
        var arrPopulation = data[1];
        var updateTime = data[2].columns[0];

        // write owid last updated time to index page
        lastUpdated = changeTimezone(updateTime);
        document.getElementById('last_update').innerHTML = '';
        document.getElementById('last_update').innerHTML += ' <small class="text-muted">Data updated: ' + lastUpdated + '</small>';

        // create sortable value from date and concat to use in matching/joins
        arrVaccinations.forEach(function(d) {
            d.daily_vaccinations_per_hundred = (d.daily_vaccinations_per_million / 10000).toFixed(2);
            d.date_sort = d.date.split('-').join('');
            d.concatLocDate = d.location + d.date;
        });

        const ctryListOECD = ["Australia", "Austria", "Belgium", "Canada", "Chile", "Colombia", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Israel", "Italy", "Japan", "South Korea", "Latvia", "Lithuania", "Luxembourg", "Mexico", "Netherlands", "New Zealand", "Norway", "Poland", "Portugal", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey", "United Kingdom", "United States"]; // include only these in OECD

        const ctryListG20 = ["Argentina", "Australia", "Brazil", "Canada", "China", "France", "Germany", "India", "Indonesia", "Italy", "Japan", "Mexico", "Russia", "Saudi Arabia", "South Africa", "South Korea", "Turkey", "United Kingdom", "United States"]; // include only these in G20

        const ctryListAll = ["England", "European Union", "Northern Ireland", "Scotland", "Wales", "World", "Africa", "Asia", "Europe", "North America", "South America", "Oceania"]; // exclude these from all

        // filter arrVaccinations based on selCountryGroup
        if (selCountryGroup == 'OECD') {
            var arrVacDetail = arrVaccinations.filter(function(item){
                return ctryListOECD.indexOf(item.location) != -1;
              });
        } else if (selCountryGroup == 'G20') {
            var arrVacDetail = arrVaccinations.filter(function(item){
                return ctryListG20.indexOf(item.location) != -1;
              });
        } else { // condition 'all'
            var arrVacDetail = arrVaccinations.filter(function(item){
                return ctryListAll.indexOf(item.location) === -1;
            });
        }

        // sort arrVacDetail array by location asc & date desc to get ready for fill up next
        arrVacDetail.sort((a, b) => a.location.localeCompare(b.location) || a.date_sort - b.date_sort);

        // create new fill up arrays
        arrTotalVacPer100Filled = getFilledUpArray(arrVacDetail.map(function(i){return i.total_vaccinations_per_hundred;}));
        arrTotalVacFilled = getFilledUpArray(arrVacDetail.map(function(i){return i.total_vaccinations;}));
        arrDailyVacPer100Filled = getFilledUpArray(arrVacDetail.map(function(i){return i.daily_vaccinations_per_hundred;}));
        arrPeopleVacPer100Filled = getFilledUpArray(arrVacDetail.map(function(i){return i.people_vaccinated_per_hundred;}));
        arrPeopleVacFilled = getFilledUpArray(arrVacDetail.map(function(i){return i.people_vaccinated;}));

        // write new fill up arrays back to arrVacDetail
        let i = 0;
        arrVacDetail.forEach(function(d) {
            d.total_vaccinations_per_hundred_filled = arrTotalVacPer100Filled[i];
            d.total_vaccinations_filled = arrTotalVacFilled[i];
            d.daily_vaccinations_per_hundred_filled = arrDailyVacPer100Filled[i];
            d.people_vaccinated_per_hundred_filled = arrPeopleVacPer100Filled[i];
            d.people_vaccinated_filled = arrPeopleVacFilled[i];
            i++;
        });

        // create last_observation_date from vaccinations eg max date by location 
        var arrLastObservationDate = d3.nest()
        .key(function(d) { 
            return d.location; 
        })
        .rollup(function(v) { 
            return {
                last_observation_date: d3.max(v, function(d) { return d.date; }),
            };
        })
        .entries(arrVacDetail)
        .map(function(group) {
            return {
                location: group.key,
                last_observation_date: group.value.last_observation_date
            }
        });

        // left join arrPopulationFilter to location
        var arrLastObsPop = equijoinWithDefault(
            arrLastObservationDate, arrPopulation, 
            "location", "entity", 
            ({location, last_observation_date}, {population}, ) => 
            ({location, last_observation_date, population}), 
            {population: null});

        // left join arrVacDetail to arrLastObsPop
        var arrVacDetailLocRaw = equijoinWithDefault(
            arrVacDetail, arrLastObsPop, 
            "location", "location", 
            ({location, iso_code, date, date_sort, total_vaccinations, total_vaccinations_filled, people_vaccinated, people_vaccinated_filled, people_fully_vaccinated, daily_vaccinations_raw, daily_vaccinations, total_vaccinations_per_hundred, total_vaccinations_per_hundred_filled, people_vaccinated_per_hundred, people_vaccinated_per_hundred_filled, people_fully_vaccinated_per_hundred, daily_vaccinations_per_million, daily_vaccinations_per_hundred, daily_vaccinations_per_hundred_filled}, {last_observation_date, population}, ) => 
            ({location, iso_code, date, date_sort, total_vaccinations, total_vaccinations_filled, people_vaccinated, people_vaccinated_filled, people_fully_vaccinated, daily_vaccinations_raw, daily_vaccinations, total_vaccinations_per_hundred, total_vaccinations_per_hundred_filled, people_vaccinated_per_hundred, people_vaccinated_per_hundred_filled, people_fully_vaccinated_per_hundred, daily_vaccinations_per_million, daily_vaccinations_per_hundred,  daily_vaccinations_per_hundred_filled, last_observation_date, population}), 
            {population: null});

        // filter arrVacDetailLocRaw based on selCountryPop
        if (selCountryPop == 'all') {
            var arrVacDetailLoc = arrVacDetailLocRaw;
        } else {
            var arrVacDetailLoc = arrVacDetailLocRaw.filter(function(d) {
                return parseInt(d.population) > parseInt(selCountryPop) * 1000000;
            });
        }

        // filter arrVacDetailLoc by last observation date to get most current records only
        var arrVacCurrent = arrVacDetailLoc.filter(function(d) {
            return d.date == d.last_observation_date;
        });

        // create vacDates array with unique dates to loop through 
        var vacDates = [...new Set(arrVacDetailLoc.map(item => item.date))];

        // sort vacDates array desc order on date modified to integer
        // to loop through them desc below
        vacDates.sort(function(a,b) {
            a = a.split('-').join('');
            b = b.split('-').join('');
            //return a > b ? 1 : a < b ? -1 : 0; // asc
            return a < b ? 1 : a > b ? -1 : 0; // desc
        });

        // create history array, use below in history charts and tables
        var arrHistory = [];

        for (i = 0; i < vacDates.length; i++) {

            // define current date
            let vacDate = vacDates[i];

            // filter array to dates less than current date
            let arrHistoryDateAll = arrVacDetailLoc.filter(function(d) { 
                return d.date <= vacDate;
            });

            // summarize by max date
            let arrHistoryDate = d3.nest()
            .key(function(d) { 
                return d.location; 
            })
            .rollup(function(v) { 
                return {
                    date: d3.max(v, function(d) { return d.date; })
                };
            })
            .entries(arrHistoryDateAll)
            .map(function(group) {
                return {
                    location: group.key,
                    date: group.value.date
                }
            });

            // create concat location and date to join arrays
            arrHistoryDateAll.forEach(function(d) {
                d.concatLocDate = d.location + d.date;
            });
            arrHistoryDate.forEach(function(d) {
                d.concatLocDate = d.location + d.date;
            });
            
            // create required variables in arrLoopData array
            arrHistoryDate.forEach(function(d) {
                d.total_vaccinations_filled = arrHistoryDateAll.find(x => x.concatLocDate === d.concatLocDate).total_vaccinations_filled;
                d.total_vaccinations_per_hundred_filled = arrHistoryDateAll.find(x => x.concatLocDate === d.concatLocDate).total_vaccinations_per_hundred_filled;
                d.daily_vaccinations_per_hundred_filled = arrHistoryDateAll.find(x => x.concatLocDate === d.concatLocDate).daily_vaccinations_per_hundred_filled;
                d.people_vaccinated_filled = arrHistoryDateAll.find(x => x.concatLocDate === d.concatLocDate).people_vaccinated_filled;
                d.people_vaccinated_per_hundred_filled = arrHistoryDateAll.find(x => x.concatLocDate === d.concatLocDate).people_vaccinated_per_hundred_filled;
            });

            arrHistory.push( {'date' : vacDate, 'country_count' : arrHistoryDate.length, 'country_data' : arrHistoryDate});

        }

        // CREATE CHART
        function createTotalPer100RankChart() {
            // create new array to sort
            let arrVacCurrentTotalRank = [...arrVacCurrent];
            let arrVacCurrentTotalChart = [...arrVacCurrent];
            
            // sort to get chart order
            arrVacCurrentTotalChart.sort((a, b) => {
                return a.total_vaccinations_per_hundred_filled - b.total_vaccinations_per_hundred_filled;
            });

            // sort to get rank order
            arrVacCurrentTotalRank.sort((a, b) => {
                return b.total_vaccinations_per_hundred_filled - a.total_vaccinations_per_hundred_filled;
            });

            // Create chart text content
            let countryRank = arrVacCurrentTotalRank.findIndex(x => x.location === selCountry) + 1;
            let per100 = arrVacCurrentTotalRank.find(x => x.location === selCountry).total_vaccinations_per_hundred_filled;
            let countryCount = arrVacCurrent.length;

            // create divs, para for chart
            document.getElementById('div_total_per100_rank').innerHTML = '';
            let divTitle = document.createElement("h4");
            let divDesc= document.createElement("p");
            let divChart = document.createElement("div");
            divChart.id = 'div_total_per100_rank_chart';
            let chartTitle = 'Current Total Doses Per 100 People Global Rank - ' + selCountry + ' vs ' + selCountryGroup + ' countries ' + ((selCountryPop=='all') ? '' : '>' + selCountryPop + 'm population');
            let chartDesc = 'Shows current global rank by total doses administered per 100 people for all ' + countryCount + ' ' + ((selCountryGroup=='all') ? '' : selCountryGroup) + ' countries ' + ((selCountryPop=='all') ? '' : 'greater than ' + selCountryPop + ' million population') + ' in OWID dataset. Note over time, as OWID adds new countries to its dataset, ' + selCountry + ' past rank may change to account for new data.';
            divTitle.innerHTML = chartTitle;
            divDesc.innerHTML = chartDesc;
            //document.getElementById('div_total_per100_rank').append(divTitle);
            //document.getElementById('div_total_per100_rank').append(divDesc);
            document.getElementById('div_total_per100_rank').append(divChart);
    
            // define x and y axis arrays
            let x = [];
            let yPer100 = [];
    
            // create axes x and y arrays
            for (let i=0; i<arrVacCurrentTotalRank.length; i++) {
                let row = arrVacCurrentTotalRank[i];
                x.push(row['location']);
                yPer100.push(row['total_vaccinations_per_hundred_filled']);
            }

            // create chart trace
            let trPer100 = {
                name: 'Doses Per 100',
                hoverlabel: {
                    namelength :-1
                },
                x: x,
                y: yPer100,
                showgrid: false,
                fill: 'tozeroy',
                type: 'bar',
                //orientation: 'h',
                marker:{
                    color: fillColor(x) // color selCountry bar blue, other bars gray
                },
            };

            // create chart layout
            let layout = {
                title: {
                    text:'Total Doses Per 100 People <br> ' + selCountry + ': ' + countryRank + ' of ' + countryCount + ((selCountryGroup=='all') ? '' : ' ' + selCountryGroup) + ' countries' + ((selCountryPop=='all') ? '' : ' >' + selCountryPop + 'm pop'),
                    font: {
                        size: 14
                    },
                },
                height: 400,
                autosize: true,
                autoscale: false,
                margin: {
                    l: 40,
                    r: 40,
                    b: 120,
                    t: 40
                },
                xaxis: { 
                    tickfont: {
                        size: 8
                    },
                    showgrid: false,
                    tickmode: 'linear',
                },
                yaxis: { 
                    tickfont: {
                        size: 11
                    },
                    showgrid: false
                }
            }

            // define plotly data, config, create chart
            let data = [trPer100];
            let config = {responsive: true}
            Plotly.newPlot('div_total_per100_rank_chart', data, layout, config);

        }

        // CREATE CHART
        function createDailyPer100RankChart() {
            // create new array to sort
            let arrVacCurrentDailyRank = [...arrVacCurrent];
            let arrVacCurrentDailyChart = [...arrVacCurrent];
            
            // sort to get chart order
            arrVacCurrentDailyChart.sort((a, b) => {
                return a.daily_vaccinations_per_hundred_filled - b.daily_vaccinations_per_hundred_filled;
            });

            // sort to get rank order
            arrVacCurrentDailyRank.sort((a, b) => {
                return b.daily_vaccinations_per_hundred_filled - a.daily_vaccinations_per_hundred_filled;
            });

            // Create chart text content
            let countryRank = arrVacCurrentDailyRank.findIndex(x => x.location === selCountry) + 1;
            let per100 = arrVacCurrentDailyRank.find(x => x.location === selCountry).daily_vaccinations_per_hundred_filled;
            let countryCount = arrVacCurrent.length;

            // create divs, para for chart
            document.getElementById('div_daily_per100_rank').innerHTML = '';
            let divTitle = document.createElement("h4");
            let divDesc= document.createElement("p");
            let divChart = document.createElement("div");
            divChart.id = 'div_daily_per100_rank_chart';
            let chartTitle = 'Current Daily Doses Per 100 People Global Rank - ' + selCountry + ' compared to ' + selCountryGroup + ' countries ' + ((selCountryPop=='all') ? '' : '>' + selCountryPop + 'm population');
            let chartDesc = 'Shows current global rank by daily doses administered per 100 people for all ' + countryCount + ' ' + ((selCountryGroup=='all') ? '' : selCountryGroup) + ' countries ' + ((selCountryPop=='all') ? '' : 'greater than ' + selCountryPop + ' million population') + ' in OWID dataset. Note over time, as OWID adds new countries to its dataset, ' + selCountry + ' past rank may change to account for new data.';
            divTitle.innerHTML = chartTitle;
            divDesc.innerHTML = chartDesc;
            //document.getElementById('div_daily_per100_rank').append(divTitle);
            //document.getElementById('div_daily_per100_rank').append(divDesc);
            document.getElementById('div_daily_per100_rank').append(divChart);
    
            // define x and y axis arrays
            let x = [];
            let yPer100 = [];
    
            // create axes x and y arrays
            for (let i=0; i<arrVacCurrentDailyRank.length; i++) {
                let row = arrVacCurrentDailyRank[i];
                x.push(row['location']);
                yPer100.push(row['daily_vaccinations_per_hundred_filled']);
            }

            // create chart trace
            let trPer100 = {
                name: 'Doses Per 100',
                hoverlabel: {
                    namelength :-1
                },
                x: x,
                y: yPer100,
                showgrid: false,
                fill: 'tozeroy',
                type: 'bar',
                //orientation: 'h',
                marker:{
                    color: fillColor(x) // color selCountry bar blue, other bars gray
                },
            };

            // create chart layout
            let layout = {
                title: {
                    text:'Daily Doses Per 100 People <br> ' + selCountry + ': ' + countryRank + ' of ' + countryCount + ((selCountryGroup=='all') ? '' : ' ' + selCountryGroup) + ' countries' + ((selCountryPop=='all') ? '' : ' >' + selCountryPop + 'm pop'),
                    font: {
                        size: 14
                    },
                },
                height: 400,
                autosize: true,
                autoscale: false,
                margin: {
                    l: 40,
                    r: 40,
                    b: 120,
                    t: 40
                },
                xaxis: { 
                    tickfont: {
                        size: 8
                    },
                    showgrid: false,
                    tickmode: 'linear',
                },
                yaxis: { 
                    tickfont: {
                        size: 11
                    },
                    showgrid: false
                }
            }

            // define plotly data, config, create chart
            let data = [trPer100];
            let config = {responsive: true}
            Plotly.newPlot('div_daily_per100_rank_chart', data, layout, config);

        }

        // CREATE CHART
        function createPeopleVaxPer100RankChart() {
            // create new array to sort
            let arrVacCurrentPeopleVaxRank = [...arrVacCurrent];
            let arrVacCurrentPeopleVaxChart = [...arrVacCurrent];
            
            // sort to get chart order
            arrVacCurrentPeopleVaxChart.sort((a, b) => {
                return a.people_vaccinated_per_hundred_filled - b.people_vaccinated_per_hundred_filled;
            });

            // sort to get rank order
            arrVacCurrentPeopleVaxRank.sort((a, b) => {
                return b.people_vaccinated_per_hundred_filled - a.people_vaccinated_per_hundred_filled;
            });

            // Create chart text content
            let countryRank = arrVacCurrentPeopleVaxRank.findIndex(x => x.location === selCountry) + 1;
            let per100 = arrVacCurrentPeopleVaxRank.find(x => x.location === selCountry).people_vaccinated_per_hundred_filled;
            let countryCount = arrVacCurrent.length;

            // create divs, para for chart
            document.getElementById('div_people_vax_per100_rank').innerHTML = '';
            let divTitle = document.createElement("h4");
            let divDesc= document.createElement("p");
            let divChart = document.createElement("div");
            divChart.id = 'div_people_vax_per100_rank_chart';
            let chartTitle = 'Current People Vaccinated Per 100 People Global Rank - ' + selCountry + ' vs ' + selCountryGroup + ' countries ' + ((selCountryPop=='all') ? '' : '>' + selCountryPop + 'm population');
            let chartDesc = 'Shows current global rank by people vaccinated per 100 people for all ' + countryCount + ' ' + ((selCountryGroup=='all') ? '' : selCountryGroup) + ' countries ' + ((selCountryPop=='all') ? '' : 'greater than ' + selCountryPop + ' million population') + ' in OWID dataset. Note over time, as OWID adds new countries to its dataset, ' + selCountry + ' past rank may change to account for new data.';
            divTitle.innerHTML = chartTitle;
            divDesc.innerHTML = chartDesc;
            //document.getElementById('div_people_vax_per100_rank').append(divTitle);
            //document.getElementById('div_people_vax_per100_rank').append(divDesc);
            document.getElementById('div_people_vax_per100_rank').append(divChart);
    
            // define x and y axis arrays
            let x = [];
            let yPer100 = [];
    
            // create axes x and y arrays
            for (let i=0; i<arrVacCurrentPeopleVaxRank.length; i++) {
                let row = arrVacCurrentPeopleVaxRank[i];
                x.push(row['location']);
                yPer100.push(row['people_vaccinated_per_hundred_filled']);
            }

            // create chart trace
            let trPer100 = {
                name: 'Vaccinated Per 100',
                hoverlabel: {
                    namelength :-1
                },
                x: x,
                y: yPer100,
                showgrid: false,
                fill: 'tozeroy',
                type: 'bar',
                //orientation: 'h',
                marker:{
                    color: fillColor(x) // color selCountry bar blue, other bars gray
                },
            };

            // create chart layout
            let layout = {
                title: {
                    text:'People Vaccinated Per 100 People <br> ' + selCountry + ': ' + countryRank + ' of ' + countryCount + ((selCountryGroup=='all') ? '' : ' ' + selCountryGroup) + ' countries' + ((selCountryPop=='all') ? '' : ' >' + selCountryPop + 'm pop'),
                    font: {
                        size: 14
                    },
                },
                height: 400,
                autosize: true,
                autoscale: false,
                margin: {
                    l: 40,
                    r: 40,
                    b: 120,
                    t: 40
                },
                xaxis: { 
                    tickfont: {
                        size: 8
                    },
                    showgrid: false,
                    tickmode: 'linear',
                },
                yaxis: { 
                    tickfont: {
                        size: 11
                    },
                    showgrid: false
                }
            }

            // define plotly data, config, create chart
            let data = [trPer100];
            let config = {responsive: true}
            Plotly.newPlot('div_people_vax_per100_rank_chart', data, layout, config);

        }

        // CREATE CHART
        function createTotalPer100RankHistoryChart() {

            // define x and y axis arrays
            let x = [];
            let yRank = [];
            let yCtryCount = [];

            let arrHistoryTotal = [...arrHistory];

            for (i = 0; i < arrHistoryTotal.length; i++) {
                // order country_data desc by total_vaccinations_per_hundred to get rank
                arrHistoryTotal[i]['country_data'].sort((a, b) => {
                    return b.total_vaccinations_per_hundred_filled - a.total_vaccinations_per_hundred_filled;
                });
                let countryRank = arrHistoryTotal[i]['country_data'].findIndex(x => x.location === selCountry) + 1;
                // create chart arrays
                x.push(arrHistoryTotal[i]['date']);
                yCtryCount.push(arrHistoryTotal[i]['country_count']);
                yRank.push(countryRank);
            }
            
            // create max values for y axis range 
            //let maxRank = Math.max(...yRank);
            let maxCount = Math.max(...yCtryCount);

            // create chart traces
            let trCountryRank = {
                name: selCountry + ' Rank',
                hoverlabel: {
                    namelength :-1
                },
                x: x,
                y: yRank,
                type: 'line',
                marker:{
                    color: clrBlue
                },
            };

            let trCountryCount = {
                name: '# Countries',
                hoverlabel: {
                    namelength :-1
                },
                x: x,
                y: yCtryCount,
                type: 'bar',
                marker:{
                    color: clrGray
                },
            };

            let trRankPctile = {
                name: 'Rank Percentile',
                hoverlabel: {
                    namelength :-1
                },
                yaxis: 'y2',
                x: x,
                y: getPercentile(yRank, yCtryCount),
                type: 'line',
                line: {
                    dash: 'dot',
                    width: 2
                },
                marker:{
                    color: clrBlue
                },
            };

            // create chart layout
            let layout = {
                title: {
                    text: selCountry + ' Total Doses Per 100 People <br> Historical rank vs ' + ((selCountryGroup=='all') ? 'all countries' : selCountryGroup + ' countries') + ((selCountryPop=='all') ? '' : ' >' + selCountryPop + 'm pop'),
                    font: {
                        size: 14
                    },
                },
                autosize: true,
                autoscale: false,
                //width: 800,
                height: 500,
                margin: {
                    l: 40,
                    r: 40,
                    b: 80,
                    t: 180
                },
                showlegend: true,
                legend: {
                    "orientation": "h",
                    "y": 1.26, 
                    "x": 0.25,
                    xanchor: 'left',
                    bgcolor: clrWhiteTransparent,
                    font: {
                        size: 10
                    },
                },
                xaxis: { 
                    tickfont: {
                        size: 11
                    },
                    showgrid: false
                },
                yaxis: { 
                    title: {
                        text: 'rank & country count',
                        font: {
                            size: 12
                        },
                    },
                    tickfont: {
                        size: 11
                    },
                    range:[0, roundUp10(maxCount)],
                    showgrid: false
                },
                yaxis2: {
                    title: {
                        text: 'rank percentile',
                        font: {
                            size: 11,
                        },
                    },
                    tickfont: {
                        size: 11
                    },
                    range: [0, 100],
                    overlaying: 'y',
                    side: 'right',
                    showgrid: false,
                    rangemode: 'tozero',
                }
            }

            // create content for section

            document.getElementById('div_total_per100_rank_history').innerHTML = '';
            let divChart = document.createElement("div");
            divChart.id = 'div_total_rank_history_chart';

            /*
            let divTitle = document.createElement("h4");
            let divDesc= document.createElement("p");
            let divTable = document.createElement("div");
            let chartTitle = 'Historical Total Doses Per 100 People Global Rank - ' + selCountry + ' vs ' + ((selCountryGroup=='all') ? 'all' : selCountryGroup) + ' countries ' + ((selCountryPop=='all') ? '' : '>' + selCountryPop + 'm population');
            
            let chartDesc = 'Shows ' + selCountry + ' historical total doses per 100 global rank and rank percentile vs all ' + selCountryGroup + ' countries' + ((selCountryPop=='all') ? '' : ' greater than ' + selCountryPop + ' million population ') + ' in OWID dataset. Rank percentile captures rank independent of country count which increases with time.';
            divTitle.innerHTML = chartTitle;
            divDesc.innerHTML = chartDesc;
            divTable.innerHTML = '<h4>Total Doses Per 100 People</h4>' + '<p>One table per day containing a list of countries ordered by doses administered per 100 people rank, with country name, doses administered per 100 and total doses administered. ' + selCountry + ' is highlighted red. Click <span class="font-italic">hide/show</span> to see and hide table details.</p>' + rankTables;
            document.getElementById('div_total_per100_rank_history').append(divTitle);
            document.getElementById('div_total_per100_rank_history').append(divDesc);
            //document.getElementById('div_total_per100_rank_history').append(divTable);
            */
            document.getElementById('div_total_per100_rank_history').append(divChart);
            
            // create plotly data, config, chart
            let data = [trCountryRank, trRankPctile, trCountryCount];
            let config = {responsive: true}
            Plotly.newPlot('div_total_rank_history_chart', data, layout, config);

        }

        // CREATE CHART
        function createDailyPer100RankHistoryChart() {

            // define x and y axis arrays
            let x = [];
            let yRank = [];
            let yCtryCount = [];

            let arrHistoryDaily = [...arrHistory];

            for (i = 0; i < arrHistoryDaily.length; i++) {
                // order country_data desc by daily_vaccinations_per_hundred_filled to get rank
                arrHistoryDaily[i]['country_data'].sort((a, b) => {
                    return b.daily_vaccinations_per_hundred_filled - a.daily_vaccinations_per_hundred_filled;
                });
                let countryRank = arrHistoryDaily[i]['country_data'].findIndex(x => x.location === selCountry) + 1;
                // create chart arrays
                x.push(arrHistoryDaily[i]['date']);
                yCtryCount.push(arrHistoryDaily[i]['country_count']);
                yRank.push(countryRank);
            }

            // create max values for y axis range 
            //let maxRank = Math.max(...yRank);
            let maxCount = Math.max(...yCtryCount);

            // create chart traces
            let trCountryRank = {
                name: selCountry + ' Rank',
                hoverlabel: {
                    namelength :-1
                },
                x: x,
                y: yRank,
                type: 'line',
                marker:{
                    color: clrBlue
                },
            };

            let trCountryCount = {
                name: '# Countries',
                hoverlabel: {
                    namelength :-1
                },
                x: x,
                y: yCtryCount,
                type: 'bar',
                marker:{
                    color: clrGray
                },
            };

            let trRankPctile = {
                name: 'Rank Percentile',
                hoverlabel: {
                    namelength :-1
                },
                yaxis: 'y2',
                x: x,
                y: getPercentile(yRank, yCtryCount),
                type: 'line',
                line: {
                    dash: 'dot',
                    width: 2
                },
                marker:{
                    color: clrBlue
                },
            };

            // create chart layout
            let layout = {
                title: {
                    text: selCountry + ' Daily Doses Per 100 People <br> Historical rank vs ' + ((selCountryGroup=='all') ? 'all countries' : selCountryGroup + ' countries') + ((selCountryPop=='all') ? '' : ' >' + selCountryPop + 'm pop'),
                    font: {
                        size: 14
                    },
                },
                autosize: true,
                autoscale: false,
                //width: 800,
                height: 500,
                margin: {
                    l: 40,
                    r: 40,
                    b: 80,
                    t: 180
                },
                showlegend: true,
                legend: {
                    "orientation": "h",
                    "y": 1.26, 
                    "x": 0.25,
                    xanchor: 'left',
                    bgcolor: clrWhiteTransparent,
                    font: {
                        size: 10
                    },
                },
                xaxis: { 
                    tickfont: {
                        size: 11
                    },
                    showgrid: false
                },
                yaxis: { 
                    title: {
                        text: 'rank & country count',
                        font: {
                            size: 12
                        },
                    },
                    tickfont: {
                        size: 11
                    },
                    range:[0, roundUp10(maxCount)],
                    showgrid: false
                },
                yaxis2: {
                    title: {
                        text: 'rank percentile',
                        font: {
                            size: 11,
                        },
                    },
                    tickfont: {
                        size: 11
                    },
                    range: [0, 100],
                    overlaying: 'y',
                    side: 'right',
                    showgrid: false,
                    rangemode: 'tozero',
                },
               // hovermode:'closest',
            }

            // create content for section
            document.getElementById('div_daily_per100_rank_history').innerHTML = '';
            let divChart = document.createElement("div");
            divChart.id = 'div_daily_rank_history_chart';

            /*
            let divTitle = document.createElement("h4");
            let divDesc= document.createElement("p");
            let divTable = document.createElement("div");
            let chartTitle = 'Historical Daily Doses Per 100 People Global Rank - ' + selCountry + ' vs ' + ((selCountryGroup=='all') ? 'all' : selCountryGroup) + ' countries ' + ((selCountryPop=='all') ? '' : '>' + selCountryPop + 'm population');
            let chartDesc = 'Shows ' + selCountry + ' historical daily doses per 100 global rank and rank percentile vs all ' + selCountryGroup + ' countries' + ((selCountryPop=='all') ? '' : ' greater than ' + selCountryPop + ' million population ') + ' in OWID dataset. Rank percentile captures rank independent of country count which increases with time.';
            divTitle.innerHTML = chartTitle;
            divDesc.innerHTML = chartDesc;
            divTable.innerHTML = '<h4>Historical Daily Doses Per 100 People Global Rank</h4>' + '<p>One table per day containing a list of countries ordered by daily doses administered per 100 people rank, with country name, doses administered per 100 and total doses administered. ' + selCountry + ' is highlighted red. Click <span class="font-italic">hide/show</span> to see and hide table details.</p>' + rankTables;
            //document.getElementById('div_daily_per100_rank_history').append(divTitle);
            //document.getElementById('div_daily_per100_rank_history').append(divDesc);
            //document.getElementById('div_daily_per100_rank_history').append(divTable);
            */
            document.getElementById('div_daily_per100_rank_history').append(divChart);

            // create plotly data, config, chart
            let data = [trCountryRank, trRankPctile, trCountryCount];
            let config = {responsive: true}
            Plotly.newPlot('div_daily_rank_history_chart', data, layout, config);

        }

        // CREATE CHART
        function createPeopleVaxPer100RankHistoryChart() {

            // define x and y axis arrays
            let x = [];
            let yRank = [];
            let yCtryCount = [];

            let arrHistoryPeople = [...arrHistory];

            for (i = 0; i < arrHistoryPeople.length; i++) {
                // order country_data desc by daily_vaccinations_per_hundred_filled to get rank
                arrHistoryPeople[i]['country_data'].sort((a, b) => {
                    return b.people_vaccinated_per_hundred_filled - a.people_vaccinated_per_hundred_filled;
                });
                let countryRank = arrHistoryPeople[i]['country_data'].findIndex(x => x.location === selCountry) + 1;
                // create chart arrays
                x.push(arrHistoryPeople[i]['date']);
                yCtryCount.push(arrHistoryPeople[i]['country_count']);
                yRank.push(countryRank);
            }
            
            // create max values for y axis range 
            //let maxRank = Math.max(...yRank);
            let maxCount = Math.max(...yCtryCount);

            // create chart traces
            let trCountryRank = {
                name: selCountry + ' Rank',
                hoverlabel: {
                    namelength :-1
                },
                x: x,
                y: yRank,
                type: 'line',
                marker:{
                    color: clrBlue
                },
            };

            let trCountryCount = {
                name: '# Countries',
                hoverlabel: {
                    namelength :-1
                },
                x: x,
                y: yCtryCount,
                type: 'bar',
                marker:{
                    color: clrGray
                },
            };

            let trRankPctile = {
                name: 'Rank Percentile',
                hoverlabel: {
                    namelength :-1
                },
                yaxis: 'y2',
                x: x,
                y: getPercentile(yRank, yCtryCount),
                type: 'line',
                line: {
                    dash: 'dot',
                    width: 2
                },
                marker:{
                    color: clrBlue
                },
            };

            // create chart layout
            let layout = {
                title: {
                    text: selCountry + ' People Vaccinated Per 100 People <br> Historical rank vs ' + ((selCountryGroup=='all') ? 'all countries' : selCountryGroup + ' countries') + ((selCountryPop=='all') ? '' : ' >' + selCountryPop + 'm pop'),
                    font: {
                        size: 14
                    },
                },
                autosize: true,
                autoscale: false,
                //width: 800,
                height: 500,
                margin: {
                    l: 40,
                    r: 40,
                    b: 80,
                    t: 180
                },
                showlegend: true,
                legend: {
                    "orientation": "h",
                    "y": 1.26, 
                    "x": 0.25,
                    xanchor: 'left',
                    bgcolor: clrWhiteTransparent,
                    font: {
                        size: 10
                    },
                },
                xaxis: { 
                    tickfont: {
                        size: 11
                    },
                    showgrid: false
                },
                yaxis: { 
                    title: {
                        text: 'rank & country count',
                        font: {
                            size: 12
                        },
                    },
                    tickfont: {
                        size: 11
                    },
                    range:[0, roundUp10(maxCount)],
                    showgrid: false
                },
                yaxis2: {
                    title: {
                        text: 'rank percentile',
                        font: {
                            size: 11,
                        },
                    },
                    tickfont: {
                        size: 11
                    },
                    range: [0, 100],
                    overlaying: 'y',
                    side: 'right',
                    showgrid: false,
                    rangemode: 'tozero',
                },
               // hovermode:'closest',
            }

            // create content for section
            document.getElementById('div_people_vax_per100_rank_history').innerHTML = '';
            let divChart = document.createElement("div");
            divChart.id = 'div_people_vax_per100_rank_history_chart';
            /*
            let divTitle = document.createElement("h4");
            let divDesc= document.createElement("p");
            let divTable = document.createElement("div");
            let chartTitle = 'Historical People Vaccinated Per 100 People Global Rank - ' + selCountry + ' vs ' + ((selCountryGroup=='all') ? 'all' : selCountryGroup) + ' countries ' + ((selCountryPop=='all') ? '' : '>' + selCountryPop + 'm population');
            let chartDesc = 'Shows ' + selCountry + ' historical people vaccinated per 100 people global rank and rank percentile vs all ' + selCountryGroup + ' countries' + ((selCountryPop=='all') ? '' : ' greater than ' + selCountryPop + ' million population ') + ' in OWID dataset. Rank percentile captures rank independent of country count which increases with time.';
            divTitle.innerHTML = chartTitle;
            divDesc.innerHTML = chartDesc;
            divTable.innerHTML = '<h4>Historical People Vaccinated Per 100 People Global Rank</h4>' + '<p>One table per day containing a list of countries ordered by people vaccinated per 100 people rank, with country name, doses administered per 100 and total doses administered. ' + selCountry + ' is highlighted red. Click <span class="font-italic">hide/show</span> to see and hide table details.</p>' + rankTables;
            //document.getElementById('div_people_vax_per100_rank_history').append(divTitle);
            //document.getElementById('div_people_vax_per100_rank_history').append(divDesc);
            //document.getElementById('div_people_vax_per100_rank_history').append(divTable);
            */
            document.getElementById('div_people_vax_per100_rank_history').append(divChart);
            
            // create plotly data, config, chart
            let data = [trCountryRank, trRankPctile, trCountryCount];
            let config = {responsive: true}
            Plotly.newPlot('div_people_vax_per100_rank_history_chart', data, layout, config);

        }
        
        // create charts when page loads
        createTotalPer100RankChart();
        createDailyPer100RankChart();
        createPeopleVaxPer100RankChart();
        createTotalPer100RankHistoryChart();
        createDailyPer100RankHistoryChart();
        createPeopleVaxPer100RankHistoryChart();

    });
}


// FUNCTIONS

// country group button clicks
$('.country-group').on( 'click', function() {
    var selCountryGroup = $(this).val();
    getData(selCountry, selCountryGroup, selCountryPop);
});

// country population button clicks
$('.country-pop').on( 'click', function() {
    var selCountryPop = $(this).val();
    getData(selCountry, selCountryGroup, selCountryPop);
});

// fill up arrays
function getFilledUpArray(array) {
    let lastDefinedElement;
    return array.map(element => {
        if (element === "") {
            element = lastDefinedElement;
        }
        lastDefinedElement = element;
        return element;
    });
}

function toggleTable(tableId) {
   if (document.getElementById(tableId).style.display == "table" ) {
       document.getElementById(tableId).style.display="none";
   } else {
      document.getElementById(tableId).style.display="table";
   }
}

// get rank percentile for single rank / country count
function getRankPctile(rank, ctryCount) {
    return parseInt((ctryCount - rank + 1) / ctryCount * 100);
}

// get rank percentile for array of ranks / country counts
function getPercentile(arrRank, arrCtryCount) {
    results = [];
    for (let i=0; i<arrRank.length; i++) {
        if (arrRank[i] > 0) {
            results.push(parseInt((arrCtryCount[i] - arrRank[i] + 1) / arrCtryCount[i] * 100));
        } else {
            results.push(0);
        }
    }
    return results
}

// used to round up y axis range max value
function roundUp10(x) {
    return Math.ceil(x / 10) * 10;
}

// left join function used to join datasets
function equijoinWithDefault(xs, ys, primary, foreign, sel, def) {
    const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
    return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
}

function changeTimezone(d) {
    let date = new Date(d);
    let dateEST = new Date(date.setHours(date.getHours() - 5));
    return new Date(dateEST.getTime() - (dateEST.getTimezoneOffset() * 60000)).toISOString().replace('T', ' ').slice(0, -8) + ' EST';
}

// assign bar color based on location
function fillColor(x) {
    colors = [];
    for (let i=0; i<x.length; i++) {
        if (x[i] == selCountry) {
            colors.push(clrBlue);
        } else {
            colors.push(clrGray);
        }
    }
    return colors
}

