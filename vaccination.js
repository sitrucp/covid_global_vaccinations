
// get files from OWID github repository
var file_update_time = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/owid-covid-data-last-updated-timestamp.txt";
var file_vaccinations = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/vaccinations/vaccinations.csv";
var file_locations = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/vaccinations/locations.csv";
var file_population = "https://raw.githubusercontent.com/owid/COVID-19-data/master/scripts/input/un/population_2020.csv";

// define color variables 
var clrBlue = 'rgba(49,130,189,.9)';
var clrGray = 'rgba(204,204,204,.9)';
var clrBlack = 'rgba(0,0,0,.9)';
var clrWhiteTransparent = 'rgba(255,255,255,0)';

// define country filter variable
var selCountry = "Canada";

// promise data from sources
Promise.all([
    d3.csv(file_vaccinations),
    d3.csv(file_locations),
    d3.csv(file_population),
    d3.csv(file_update_time),
]).then(function(data) {
    //everthing else below is in promise scope

    // get data from promise
    var arrVaccinations = data[0];
    var arrLocations = data[1];
    var arrPopulation = data[2];
    var updateTime = data[3].columns[0];

    // write owid last updated time to index page
    lastUpdated = changeTimezone(updateTime);
    document.getElementById('last_update').innerHTML += ' <small class="text-muted">Data updated: ' + lastUpdated + '</small>';

    // create sortable value from date and concat to use in matching/joins
    arrVaccinations.forEach(function(d) {
        d.date_sort = d.date.split('-').join('');
        d.concatLocDate = d.location + d.date;
    });

    // exclude dupe locations from vaccinations array
    const vacDetail = arrVaccinations.filter(function(d) { 
        return d.location != "England" && d.location != "European Union" && d.location != "Gibraltar" && d.location != "Northern Ireland" && d.location != "Scotland" && d.location != "Wales" && d.location != "World" && d.location != "Africa" && d.location != "Asia" && d.location != "Europe" && d.location != "North America" && d.location != "South America" && d.location != "Oceania";
    });

    // sort vacDetail array by location asc & date desc
    vacDetail.sort((a, b) => a.location.localeCompare(b.location) || a.date_sort - b.date_sort);

    // extract total vaccinations & per 100 into new array to fill forward values
    var arrVacPer100 = vacDetail.map(function(i){return i.total_vaccinations_per_hundred;});
    var arrTotalVaccinations = vacDetail.map(function(i){return i.total_vaccinations;});
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

    // create fill forward value arrays
    arrVacPer100Filled = getFilledUpArray(arrVacPer100);
    arrTotalVaccinationsFilled = getFilledUpArray(arrTotalVaccinations);

    // write fill forward value arrays back to vacDetail
    var i = 0;
    vacDetail.forEach(function(d) {
        d.total_vaccinations_per_hundred_filled = arrVacPer100Filled[i];
        d.total_vaccinations_filled = arrTotalVaccinationsFilled[i];
        i++;
    });

    // left join arrPopulation to location
    // population not used in page yet
    const locationPop = equijoinWithDefault(
        arrLocations, arrPopulation, 
        "location", "entity", 
        ({location, vaccines, last_observation_date}, {population}, ) => 
        ({location, vaccines, last_observation_date, population}), 
        {population:null});

    // left join locationPop to vaccinations
    const vacDetailLoc = equijoinWithDefault(
        vacDetail, locationPop, 
        "location", "location", 
        ({location, iso_code, date, date_sort, total_vaccinations, total_vaccinations_filled, people_vaccinated, people_fully_vaccinated, daily_vaccinations_raw, daily_vaccinations, total_vaccinations_per_hundred, total_vaccinations_per_hundred_filled, people_vaccinated_per_hundred, people_fully_vaccinated_per_hundred, daily_vaccinations_per_hundred, source}, {vaccines, last_observation_date, population}, ) => 
        ({location, iso_code, date, date_sort, total_vaccinations, total_vaccinations_filled, people_vaccinated, people_fully_vaccinated, daily_vaccinations_raw, daily_vaccinations, total_vaccinations_per_hundred, total_vaccinations_per_hundred_filled, people_vaccinated_per_hundred, people_fully_vaccinated_per_hundred, daily_vaccinations_per_hundred, vaccines, last_observation_date, population, source}), 
        {population: null});

    // filter vaccinations dataset by location max date to get most current records only
    const vacCurrent = vacDetailLoc.filter(function(d) {
        return d.date == d.last_observation_date;
    });

    // sort vacDetailLoc array by location asc & date desc
    vacDetailLoc.sort((a, b) => a.location.localeCompare(b.location) || a.date_sort - b.date_sort);

    // CREATE CHART
    function createGlobalRankChart() {

        // order vaccinationMaxDate desc by total_vaccinations_per_hundred to get rank
        vacCurrent.sort((a, b) => {
            return b.total_vaccinations_per_hundred_filled - a.total_vaccinations_per_hundred_filled;
        });

        // sort only to create bar chart y values to sort desc for appearance sake only
        var vacCurrentRankSort = [...vacCurrent]; 
        
        vacCurrentRankSort.sort((a, b) => {
            return a.total_vaccinations_per_hundred_filled - b.total_vaccinations_per_hundred_filled;
        });

        // Create chart text content
        var countryRank = vacCurrent.findIndex(x => x.location === selCountry) + 1;
        var per100 = vacCurrent.find(x => x.location === selCountry).total_vaccinations_per_hundred_filled;
        var countryCount = vacCurrent.length;

        // create divs, para for chart
        var divTitle = document.createElement("h4");
        var divDesc= document.createElement("p");
        var divChart = document.createElement("div");
        divChart.id = 'div_global_rank_chart';
        var chartTitle = 'Global Total Doses per 100 People - Tracking How ' + selCountry + ' Compares To Other Countries';
        var chartDesc = 'Shows global rank by total doses administered per 100 people for all ' + countryCount + ' countries currently in OWID dataset. Note over time, as OWID adds new countries to its dataset, ' + selCountry + ' past rank may change to account for new data.';
        divTitle.innerHTML = chartTitle;
        divDesc.innerHTML = chartDesc;
        document.getElementById('div_global_rank').append(divTitle);
        document.getElementById('div_global_rank').append(divDesc);
        document.getElementById('div_global_rank').append(divChart);
 
        // define x and y axis arrays
        var x = [];
        var yPer100 = [];
 
        // create axes x and y arrays
        for (var i=0; i<vacCurrentRankSort.length; i++) {
            var row = vacCurrentRankSort[i];
            x.push(row['location']);
            yPer100.push(row['total_vaccinations_per_hundred_filled']);
        }

        // create chart trace
        var trPer100 = {
            name: 'Doses Per 100',
            hoverlabel: {
                namelength :-1
            },
            x: yPer100,
            y: x,
            showgrid: false,
            fill: 'tozeroy',
            type: 'bar',
            orientation: 'h',
            marker:{
                color: fillColor(x) // color selCountry bar blue, other bars gray
            },
        };

        // create chart layout
        var layout = {
            title: {
                text:'Global Total Doses per 100 People <br> ' + selCountry + ' ' + per100 + ' Ranks ' + countryRank + ' of ' + countryCount + ' countries',
                font: {
                    size: 14
                },
            },
            height: 1300,
            autosize: true,
            autoscale: false,
            margin: {
                l: 150,
                r: 40,
                b: 60,
                t: 80,
                pad: 2
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false,
            },
            yaxis: { 
                tickfont: {
                    size: 9
                },
                showgrid: false,
                tickmode: 'linear',
            }
        }

        // define plotly data, config, create chart
        var data = [trPer100];
        var config = {responsive: true}
        Plotly.newPlot('div_global_rank_chart', data, layout, config);

    }


    // CREATE CHART
    function createDailyRankChart() {

        // create vacDates array with unique dates to loop through 
        var vacDates = [...new Set(vacDetailLoc.map(item => item.date))];

        // sort vacDates array desc order on date modified to integer
        // to loop through them desc below
        vacDates.sort(function(a,b) {
            a = a.split('-').join('');
            b = b.split('-').join('');
            //return a > b ? 1 : a < b ? -1 : 0; // asc
            return a < b ? 1 : a > b ? -1 : 0; // desc
        });

        // define x and y axis arrays
        var x = [];
        var yRank = [];
        var yCtryCount = [];

        //  define rank table varible
        var rankTables = '';
    
        // create the daily ranks and country counts:
        // loop through vacDates desc, get max date per country, that is less than loop date
        // assign max date less than loop date as country's last report date
        for (var i=0; i<vacDates.length; i++) {
            var loopDate = vacDates[i];
            // filter vacDetailLoc to dates less than loop date
            var vacDaily = vacDetailLoc.filter(function(d) { 
                return d.date <= loopDate;
            });

            // summarize location by country's last date reported <= loopDate
            var loopLocMaxDate = d3.nest()
            .key(function(d) { 
                return d.location; 
            })
            .rollup(function(v) { 
                return {
                    max_loop_date: d3.max(v, function(d) { return d.date; })
                };
            })
            .entries(vacDaily)
            .map(function(group) {
                return {
                    location: group.key,
                    max_loop_date: group.value.max_loop_date
                }
            });

            // create concat vacDaily location and date to join arrays
            vacDaily.forEach(function(d) {
                d.concatLocDate = d.location + d.date;
            });

            // create concat loopLocMaxDate location and date to join arrays
            loopLocMaxDate.forEach(function(d) {
                d.concatLocDate = d.location + d.max_loop_date;
            });
            
            // join loopLocMaxDate and vacDaily on concat location and date to get  total_vaccinations_per_hundred value from vacDaily for loop date
            loopLocMaxDate.forEach(function(d) {
                d.total_vaccinations_per_hundred_filled = vacDaily.find(x => x.concatLocDate === d.concatLocDate).total_vaccinations_per_hundred_filled;
                d.total_vaccinations_filled = vacDaily.find(x => x.concatLocDate === d.concatLocDate).total_vaccinations_filled;
            });
            
            // order loopLocMaxDate desc by total_vaccinations_per_hundred to get rank
            loopLocMaxDate.sort((a, b) => {
                return b.total_vaccinations_per_hundred_filled - a.total_vaccinations_per_hundred_filled;
            });

            // create Canada current variables
            var totalVax = loopLocMaxDate.findIndex(x => x.location === selCountry).total_vaccinations_filled;
            var countryRank = loopLocMaxDate.findIndex(x => x.location === selCountry) + 1;
            yRank.push(countryRank);
            // var per100 = loopLocMaxDate.findIndex(x => x.location === selCountry).total_vaccinations_per_hundred_filled;
            // var location = loopLocMaxDate.findIndex(x => x.location === selCountry).location; 

            // create x array and country count arrays
            x.push(loopDate);
            vCountryCount = loopLocMaxDate.length;
            yCtryCount.push(vCountryCount);

            // define table section variables
            var tableRows = '';
            
            // create table rows 
            for (var j=0; j < loopLocMaxDate.length; j++) {
                tableRow = loopLocMaxDate[j];
                vLocation = tableRow.location;
                vRank = (parseInt(j) + 1);
                vPer100 = parseFloat(tableRow.total_vaccinations_per_hundred_filled).toFixed(2);
                vTotalVax = parseInt(tableRow.total_vaccinations_filled).toLocaleString();
                vRankPctile = getRankPctile(vRank, vCountryCount);


                if (tableRow.location == selCountry) {
                    strRank = '<span style="font-weight: bold; color: red;">' + vRank + '</span>';
                    strLocation = '<span style="font-weight: bold; color: red;">' + vLocation + '</span>';
                    strPer100 = '<span style="font-weight: bold; color: red;">' + vPer100 + '</span>';
                    strTotalVax = '<span style="font-weight: bold; color: red;">' + vTotalVax + '</span>';
                    strRankPctile = '<span style="font-weight: bold; color: red;">' + vRankPctile + '</span>';
                } else {
                    strRank= vRank;
                    strLocation = vLocation;
                    strPer100 = vPer100;
                    strTotalVax = vTotalVax;
                    strRankPctile =  vRankPctile;
                };
                tableRows += '<tr class="tbl_values_row"><td>' + strRank + '</td><td>' + strLocation + '</td><td style="text-align: right;">' + strPer100 + '</td><td style="text-align: right;">' + strTotalVax + '</td><td style="text-align: right;">' + strRankPctile + '</td></tr>';
            }
            
            // create table section
            rankTable = '<table class="table-sm" id="rankTbl'+ i +'" style="display:none;"><tr><th>Rank</th><th>Location</th><th style="text-align: right;">Doses Per 100</th><th style="text-align: right;">Total Doses</th><th style="text-align: right;">Rank Percentile</th></tr>';
            rankTable += tableRows;
            rankTable += '<p class="font-weight-bold" style="margin-top: 20px;">' + loopDate + ' Rank: ' + countryRank + ' / ' + vCountryCount + ' <a class="small font-italic" onclick="toggleTable(&apos;rankTbl'+ i +'&apos;);" href="javascript:void(0);">hide/show</a> </h5>'; 
            rankTables += rankTable;
        }
        
        // create max values for y axis range 
        var maxRank = Math.max(...yRank);
        var maxCount = Math.max(...yCtryCount);

         // create chart traces
        var trCountryRank = {
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

        var trCountryCount = {
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

        var trRankPctile = {
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
        var layout = {
            title: {
                text: selCountry + ' Doses per 100 People <br> Daily Global Rank',
                font: {
                    size: 14
                },
            },
            autosize: true,
            autoscale: false,
            //width: 800,
            height: 500,
            margin: {
                l: 80,
                r: 80,
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
        var divTitle = document.createElement("h4");
        var divDesc= document.createElement("p");
        var divChart = document.createElement("div");
        var divTable = document.createElement("div");
        divChart.id = 'div_daily_rank_chart';
        var chartTitle = selCountry + ' Canada Daily Global Rank of Total Doses per 100 People - Tracking ' + selCountry + ' Daily Rank Relative To Other Countries';
        var chartDesc = 'Shows ' + selCountry + ' global rank, # countries in OWID dataset, and rank percentile by date. Rank percentile captures ' + selCountry + ' daily relative rank as more countries added to OWID dataset.';
        divTitle.innerHTML = chartTitle;
        divDesc.innerHTML = chartDesc;
        divTable.innerHTML = '<h4>Daily Global Rank of Total Doses per 100 People</h4>' + '<p>One table per day containing a list of countries ordered by doses administered per 100 people rank, with country name, doses administered per 100 and total doses administered. ' + selCountry + ' is highlighted red. Click <span class="font-italic">hide/show</span> to see and hide table details.</p>' + rankTables;
        document.getElementById('div_daily_rank').append(divTitle);
        document.getElementById('div_daily_rank').append(divDesc);
        document.getElementById('div_daily_rank').append(divChart);
        document.getElementById('div_daily_rank').append(divTable);

        // create plotly data, config, chart
        var data = [trCountryRank, trRankPctile, trCountryCount];
        var config = {responsive: true}
        Plotly.newPlot('div_daily_rank_chart', data, layout, config);

    }

    // create charts when page loads
    createGlobalRankChart();
    createDailyRankChart();

});

// FUNCTIONS

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
    for (var i=0; i<arrRank.length; i++) {
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
    var date = new Date(d);
    var dateEST = new Date(date.setHours(date.getHours() - 5));
    return new Date(dateEST.getTime() - (dateEST.getTimezoneOffset() * 60000)).toISOString().replace('T', ' ').slice(0, -8) + ' EST';
}

// assign bar color based on location
function fillColor(x) {
    colors = [];
    for (var i=0; i<x.length; i++) {
        if (x[i] == selCountry) {
            colors.push(clrBlue);
        } else {
            colors.push(clrGray);
        }
    }
    return colors
}

