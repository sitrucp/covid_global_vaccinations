
// get csv files from OWID github repository
var file_update_time = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/owid-covid-data-last-updated-timestamp.txt";

var file_vaccinations = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/vaccinations/vaccinations.csv";

// get canada working group vaccine data for pre-Jan 12 not included in owid dataset
var file_admin_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_administration_timeseries_canada.csv";

var file_locations = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/vaccinations/locations.csv";

// vaccine group file
var file_vaccine_group = "vaccine_groups.csv";

// owid population file
//var file_population = "https://raw.githubusercontent.com/owid/COVID-19-data/master/scripts/input/un/population_2020.csv";

// statscan population file
var file_population = "https://raw.githubusercontent.com/sitrucp/covid_global_vaccinations/master/population.csv";

// define color variables 
var clrBlue = 'rgba(49,130,189,.9)';
var clrGray = 'rgba(204,204,204,.9)';
var clrBlack = 'rgba(0,0,0,.9)';
var clrWhiteTransparent = 'rgba(255,255,255,0)';

Promise.all([
    d3.csv(file_vaccinations),
    d3.csv(file_admin_canada),
    d3.csv(file_locations),
    d3.csv(file_population),
    d3.csv(file_update_time),
    d3.csv(file_vaccine_group),
]).then(function(data) {
    //everthing else below is in d3 promise scope

    // get data sets from promise
    var arrVaccinationsRaw = data[0];
    var arrAdminCanada = data[1];
    var arrLocations = data[2];
    var arrPopulation = data[3];
    var updateTime = data[4].columns[0];
    var arrVaccineGroup = data[5];

    // write last updated time to index page
    lastUpdated = changeTimezone(updateTime);
    document.getElementById('last_update').innerHTML += ' <small class="text-muted">Data updated: ' + lastUpdated + '</small>';

    // create daily vaccinations per 100 column & reformatted date for sorting
    arrVaccinationsRaw.forEach(function(d) {
        d.daily_vaccinations_per_hundred = (d.daily_vaccinations_per_million / 10000).toFixed(3);
        d.date_sort = d.date.split('-').join('');
        d.concatLocDate = d.location + d.date;
        d.source = "owid";
    });

    // filter out OWID itinerant dates instead use pre Jan 12 dates
    var arrVaccinations = arrVaccinationsRaw.filter(function(d) {
        return d.source + d.concatLocDate != "owidCanada2020-12-19" && d.source + d.concatLocDate != "owidCanada2020-12-26" && d.source + d.concatLocDate != "owidCanada2021-01-02" && d.source + d.concatLocDate != "owidCanada2021-01-09";
    });

    // get canada working group vaccine data for pre-Jan 12 not included in owid dataset
    // used (37742157 / 100) to calculate per 100 per OWID methodology
    arrAdminCanada.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_administered);
        d.total_vaccinations_per_hundred = (d.cumulative_avaccine / (37742157 / 100)).toFixed(2);
        d.date_sort = reformatDate(d.date_vaccine_administered).split('-').join('');
        d.concatLocDate = d.province + d.date;
        d.source = "ccodwg";
    });
    var arrAdminPreJan12 = arrAdminCanada.filter(function(d) { 
        return d.date_sort < 20210112;
    });

    // created filtered vacDetail array excluding England, Gibralter, North Ireland, Scotland, Wales, World from vaccinations array
    const vacDetail = arrVaccinations.filter(function(d) { 
        return d.location != "England" && d.location != "European Union" && d.location != "Gibraltar" && d.location != "Northern Ireland" && d.location != "Scotland" && d.location != "Wales" && d.location != "World";
    });

    // sort vacDetail array by location asc & date desc
    vacDetail.sort((a, b) => a.location.localeCompare(b.location) || a.date_sort - b.date_sort);

    // extract total vaccinations per 100 into new array to fill forward values
    var arrVacPer100 = vacDetail.map(function(i){return i.total_vaccinations_per_hundred;});
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

    // get total_vaccinations_per_hundred_filled
    arrVacPer100Filled = getFilledUpArray(arrVacPer100);

    // write total_vaccinations_per_hundred_filled back to vacDetail
    var i = 0;
    vacDetail.forEach(function(d) {
        d.total_vaccinations_per_hundred_filled = arrVacPer100Filled[i];
        i++;
    });

    // create owid_vaccine_alt, vaccine_group columns in arrLocations
    arrLocations.forEach(function(d) {
        d.owid_vaccine_alt = getVaccineAlt(d.vaccines, arrVaccineGroup);
        d.vaccine_group = getVaccineGroup(d.vaccines, arrVaccineGroup);
    });

    // left join arrPopulation to location
    const locationPop = equijoinWithDefault(
        arrLocations, arrPopulation, 
        "location", "country", 
        ({location, vaccines, owid_vaccine_alt, vaccine_group, last_observation_date}, {population}, ) => 
        ({location, vaccines, owid_vaccine_alt, vaccine_group, last_observation_date, population}), 
        {population:null});

    // left join locationPop to vaccinations
    const vacDetailLoc = equijoinWithDefault(
        vacDetail, locationPop, 
        "location", "location", 
        ({location, iso_code, date, date_sort, total_vaccinations, people_vaccinated, people_fully_vaccinated, daily_vaccinations_raw, daily_vaccinations, total_vaccinations_per_hundred, total_vaccinations_per_hundred_filled, people_vaccinated_per_hundred, people_fully_vaccinated_per_hundred, daily_vaccinations_per_million, daily_vaccinations_per_hundred, source}, {vaccines, last_observation_date, owid_vaccine_alt, vaccine_group, population}, ) => 
        ({location, iso_code, date, date_sort, total_vaccinations, people_vaccinated, people_fully_vaccinated, daily_vaccinations_raw, daily_vaccinations, total_vaccinations_per_hundred, total_vaccinations_per_hundred_filled, people_vaccinated_per_hundred, people_fully_vaccinated_per_hundred, daily_vaccinations_per_million, daily_vaccinations_per_hundred, vaccines, last_observation_date, owid_vaccine_alt, vaccine_group, population, source}), 
        {population: null});

    // filter vaccinations dataset by location max date to get current records only
    // do before adding pre Jan 12 records
    const vacCurrent = vacDetailLoc.filter(function(d) {
        return d.date == d.last_observation_date;
    });

    // append arrAdminPreJan12 to vacDetailLoc to add pre Jan 12 total per 100 data
    for (var i=0; i<arrAdminPreJan12.length; i++) {
        obj = {
            location : arrAdminPreJan12[i].province,
            date : arrAdminPreJan12[i].report_date,
            date_sort : arrAdminPreJan12[i].date_sort,
            last_observation_date : arrAdminPreJan12[i].report_date,
            total_vaccinations : arrAdminPreJan12[i].cumulative_avaccine,
            total_vaccinations_per_hundred : arrAdminPreJan12[i].total_vaccinations_per_hundred,
            total_vaccinations_per_hundred_filled : arrAdminPreJan12[i].total_vaccinations_per_hundred,
            concatLocDate : arrAdminPreJan12[i].concatLocDate
        }
        vacDetailLoc.push(obj);
    }

    // sort vacDetailLoc array by location asc & date desc to get pre Jan 12 records in correct order
    vacDetailLoc.sort((a, b) => a.location.localeCompare(b.location) || a.date_sort - b.date_sort);

    // default button selector 
    var selVaccineGroup = "all";

    // CREATE GLOBAL PER 100 BAR CHART
    function createGlobalRankChart(selVaccineGroup) {

        // filter vacCurrent by vaccine group
        if (selVaccineGroup == 'all') {
            var vacCurrentGroup = vacCurrent;
        } else {
            var vacCurrentGroup = vacCurrent.filter(function(d) { 
                return d.vaccine_group.toLowerCase() === selVaccineGroup;
            });
        }

        // order vaccinationMaxDate desc by total_vaccinations_per_hundred
        vacCurrentGroup.sort((a, b) => {
            return b.total_vaccinations_per_hundred_filled - a.total_vaccinations_per_hundred_filled;
        });

        // Create chart text content
        var canadaRank = vacCurrentGroup.findIndex(x => x.location === "Canada") + 1;
        var canadaPer100 = vacCurrentGroup.find(x => x.location === "Canada").total_vaccinations_per_hundred_filled;
        var countryCount = vacCurrentGroup.length;

        // create divs, para for chart
        var divTitle = document.createElement("h4");
        var divDesc= document.createElement("p");
        var divChart = document.createElement("div");
        divChart.id = 'div_global_rank_chart';
        var chartTitle = "Global Total Doses per 100 People - Tracking How Canada Compares To Other Countries";
        var chartDesc = 'Shows Canada\'s relative ranking by total doses per 100 people compared to all countries currently in OWID dataset. Note over time, as OWID adds new countries to its dataset, Canada\'s past rank may change to account for new data.';
        divTitle.innerHTML = chartTitle;
        divDesc.innerHTML = chartDesc;
        document.getElementById('div_global_rank').append(divTitle);
        document.getElementById('div_global_rank').append(divDesc);
        document.getElementById('div_global_rank').append(divChart);
 
        // create x and y axis data sets
        var x = [];
        var yPer100 = [];
 
        // create axes x and y arrays
        for (var i=0; i<vacCurrentGroup.length; i++) {
            var row = vacCurrentGroup[i];
            x.push(row['location']);
            yPer100.push(row['total_vaccinations_per_hundred_filled']);
        }

        // create chart trace
        var trPer100 = {
            name: 'Doses Per 100',
            hoverlabel: {
                namelength :-1
            },
            x: x,
            y: yPer100,
            showgrid: false,
            fill: 'tozeroy',
            type: 'bar',
            marker:{
                color: fillColor(x) // color Canada bar blue, other bars gray
            },
        };

        // create chart layout
        var layout = {
            title: {
                text:'Global Total Doses per 100 People <br> Canada ' + canadaPer100 + ' Ranks ' + canadaRank + ' of ' + countryCount + ' countries',
                font: {
                    size: 14
                },
            },
            autosize: true,
            autoscale: false,
            margin: {
                l: 40,
                r: 40,
                b: 120,
                t: 80,
                pad: 2
            },
            xaxis: { 
                tickfont: {
                    size: 9
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

        // plotly data, config, create chart
        var data = [trPer100];
        var config = {responsive: true}
        Plotly.newPlot('div_global_rank_chart', data, layout, config);

    }

    // CREATE CANADA DAILY RANK PER 100 CHART
    function createCanadaDailyRankChart() {

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

        // create x and y axis array variables
        var x = [];
        var yRank = [];
        var yCtryCount = [];

        // create table row var with table header row
        var tableSections = '';
    
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
            });
            
            // order loopLocMaxDate desc by total_vaccinations_per_hundred to get rank
            loopLocMaxDate.sort((a, b) => {
                return b.total_vaccinations_per_hundred_filled - a.total_vaccinations_per_hundred_filled;
            });

            // append rank & per 100 value for pre Jan 12 dates to x and y arrays
            var canadaRank = loopLocMaxDate.findIndex(x => x.location === "Canada") + 1;
            yRank.push(canadaRank);
            var canadaPer100 = loopLocMaxDate.findIndex(x => x.location === "Canada").total_vaccinations_per_hundred_filled;
            var location = loopLocMaxDate.findIndex(x => x.location === "Canada").location;

            // get x array and country count array for all dates
            x.push(loopDate);
            yCtryCount.push(loopLocMaxDate.length);

            // define table variables
            var sectionHeader = '';
            var tableSection = '';
            var tableHeader = '';
            var tableRows = '';

            // create table section
            sectionHeader = '<h5 style="margin-top: 10px;">' + loopDate + ' Rank: ' + canadaRank + ' / ' + loopLocMaxDate.length + '</h5>'; 
            tableHeader = '<table class="table-sm"><tr><th>Rank</th><th>Location</th><th>Doses Per 100</th></tr>';

            console.log(loopDate, canadaRank, loopLocMaxDate.length)

            // create table location rows
            for (var j=0; j < loopLocMaxDate.length; j++) {
                tableRow = loopLocMaxDate[j];
                if (tableRow.location == 'Canada') {
                    strRank = '<span style="font-weight: bold; color: red;">' + (parseInt(j) + 1) + '</span>';
                    strLocation = '<span style="font-weight: bold; color: red;">' + tableRow.location + '</span>';
                    strPer100 = '<span style="font-weight: bold; color: red;">' + parseFloat(tableRow.total_vaccinations_per_hundred_filled).toFixed(2) + '</span>';
                } else {
                    strRank= (parseInt(j) + 1);
                    strLocation = tableRow.location;
                    strPer100 = parseFloat(tableRow.total_vaccinations_per_hundred_filled).toFixed(2)
                };
                tableRows += '<tr class="tbl_values_row"><td>' + strRank + '</td><td>' + strLocation + '</td><td style="text-align: right;">' + strPer100 + '</td></tr>'; 
            }

            tableSection = sectionHeader + tableHeader + tableRows;
            tableSections += tableSection;
           // <div id="rank' + i +  '" style="display: none;"></div>
        }

         // get max values for y axis range 
         var maxRank = Math.max(...yRank);
         var maxCount = Math.max(...yCtryCount);

         // create chart traces
        var trCanadaRank = {
            name: 'Canada Rank',
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
                text:'Canada Doses per 100 People <br> Daily Global Rank',
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

        // create divs, para for Canada chart
        var divTitle = document.createElement("h4");
        var divDesc= document.createElement("p");
        var divChart = document.createElement("div");
        var divTable = document.createElement("div");
        divChart.id = 'div_canada_daily_rank_chart';
        var chartTitle = "Canada Daily Global Rank of Total Doses per 100 People - Tracking Canada's Changing Rank Relative To Other Countries";
        var chartDesc = 'Shows Canada\'s global rank and # countries in OWID dataset by date. Note over time, as OWID adds new countries to its dataset, Canada\'s past rank may change to account for new data. Also while Canada has been administering vaccines since Dec 14 2020, the <a href="https://health-infobase.canada.ca/covid-19/vaccine-administration/" target=_blank">Canadian government data source</a> used by OWID only contains vaccination data starting Jan 12. Therefore, the <a href="https://github.com/ccodwg/Covid19Canada" target=_blank">COVID-19 Canada Open Data Working Group data</a> was used to get Canada\'s pre-Jan 12 rank. These datasets do not have perfectly matching dose counts which results in slight discontinuity from Jan 11 to 12 but otherwise the trend is represented well.';
        
        divTitle.innerHTML = chartTitle;
        divDesc.innerHTML = chartDesc;
        divTable.innerHTML = tableSections;
        document.getElementById('div_canada_daily_rank').append(divTitle);
        document.getElementById('div_canada_daily_rank').append(divDesc);
        document.getElementById('div_canada_daily_rank').append(divChart);
        document.getElementById('div_canada_daily_rank').append(divTable);

        // plotly data, config, create chart
        var data = [trCanadaRank, trRankPctile, trCountryCount];
        var config = {responsive: true}
        Plotly.newPlot('div_canada_daily_rank_chart', data, layout, config);

    }


    // CREATE VACCINE GROUP CHART
    function createVaccineGroupChart() {
        // create divs, para for Canada chart
        var divTitle = document.createElement("h4");
        var divDesc= document.createElement("p");
        var divChart = document.createElement("div");
        var chartTitle = "Global Share by Vaccine Group";
        var chartDesc = 'Shows count of countries by vaccine group (PMAJ, No PMAJ, Partial PMAJ). PMAJ = Pfizer, Moderna, AstraZenaca, Johnson & Johson vaccines. Non-PMAJ =  Chinese and Russian vaccines. Partial PMAJ = mix of both PMAJ and Non-PMAJ.';
        divChart.id = 'div_vaccine_group_chart';
        divTitle.innerHTML = chartTitle;
        divDesc.innerHTML = chartDesc;
        document.getElementById('div_vaccine_group').append(divTitle);
        document.getElementById('div_vaccine_group').append(divDesc);
        document.getElementById('div_vaccine_group').append(divChart);

        // summarize location by country's last date reported <= loopDate
        var arrVaccineGroupCounts = d3.nest()
        .key(function(d) { return d.vaccine_group; })
        .rollup(function(v) { return v.length; })
        .entries(vacCurrent);

        var arrVaccineGroupCounts = d3.nest()
        .key(function(d) { return d.vaccine_group; })
        .rollup(function(v) { return v.length; })
        .entries(vacCurrent)
        .map(function(group) {
            return {
            vaccine_group: group.key,
            country_count: group.value
            }
        });

        // create x and y axis data sets
        var x = [];
        var y = [];

        // create axes x and y arrays
        for (var i=0; i<arrVaccineGroupCounts.length; i++) {
            var row = arrVaccineGroupCounts[i];
            x.push(row['vaccine_group']);
            y.push(row['country_count']);
        }

        // create chart traces
        var trVaccineGroup = {
            name: 'Vaccine Group',
            hoverlabel: {
                namelength :-1
            },
            x: x,
            y: y,
            showgrid: false,
            type: 'bar',
            marker:{
                color: clrBlue
            },
        };

        // create chart layout
        var layout = {
            title: {
                text:'Vaccine Group Country Counts<br>PMAJ = Pfizer, Moderna, AstraZenaca, Johnson & Johson',
                font: {
                    size: 14
                },
            },
            autosize: true,
            autoscale: false,
            margin: {
                l: 30,
                r: 40,
                b: 80,
                t: 80,
                pad: 2
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false
            },
            yaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false
            }
        }

        // plotly data, config, create chart
        var data = [trVaccineGroup];
        var config = {responsive: true}
        Plotly.newPlot('div_vaccine_group_chart', data, layout, config);

    }

    // create charts when page loads
    createGlobalRankChart(selVaccineGroup);
    createCanadaDailyRankChart();
    //createVaccineGroupChart();

});



// FUNCTIONS

function getPercentile(arrRank, arrCtryCount) {
    results = [];
    for (var i=0; i<arrRank.length; i++) {
        if (arrRank[i] > 0) {
            results.push(parseInt((arrCtryCount[i] - arrRank[i] + 1) / arrCtryCount[i] * 100));
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

// reformat date string
function reformatDate(d) {
    // 17-12-2020 is working group date format
    var d = (d).split('-');
    var newDate = d[2] + '-' + d[1] + '-' + d[0];
    return newDate
}

function changeTimezone(d) {
    var date = new Date(d);
    var dateEST = new Date(date.setHours(date.getHours() - 5));
    return new Date(dateEST.getTime() - (dateEST.getTimezoneOffset() * 60000)).toISOString().replace('T', ' ').slice(0, -8) + ' EST';
}

// lookup to return alternate vaccine name
function getVaccineAlt(vaccine, arrVaccineGroup) {
    var x = arrVaccineGroup.find(x => x.owid_vaccine === vaccine);
    if (typeof x === 'undefined'){
        new_name = vaccine
    } else {
        new_name = x.owid_vaccine_alt
    } 
    return new_name
}

// lookup to return alternate vaccine group
function getVaccineGroup(vaccine, arrVaccineGroup) {
    var x = arrVaccineGroup.find(x => x.owid_vaccine === vaccine);
    if (typeof x === 'undefined'){
        new_name = 'unknown'
    } else {
        new_name = x.vaccine_group
    } 
    return new_name
}

// assign bar color based on x value
function fillColor(x, location) {
    colors = [];
    for (var i=0; i<x.length; i++) {
        if (x[i] == "Canada") {
            colors.push(clrBlue);
        } else {
            colors.push(clrGray);
        }
    }
    return colors
}

// hide show additional notes hidden div by clicking  read more link
function hideShowDiv(id) {
   var e = document.getElementById(id);
   if(e.style.display == 'block')
      e.style.display = 'none';
   else
      e.style.display = 'block';
}