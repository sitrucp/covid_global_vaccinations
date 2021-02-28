
// get csv files from OWID github repository
var file_update_time = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/owid-covid-data-last-updated-timestamp.txt";

var file_vaccinations = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/vaccinations/vaccinations.csv";

// get canada working group vaccine data for pre-jan 12 not included in owid dataset
var file_admin_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_administration_timeseries_canada.csv";

var file_locations = "https://raw.githubusercontent.com/owid/COVID-19-data/master/public/data/vaccinations/locations.csv";

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
    d3.csv(file_update_time)
]).then(function(data) {
    //everthing else below is in d3 promise scope

    // get data sets from promise
    var arrVaccinations = data[0];
    var arrAdminCanada = data[1];
    var arrLocations = data[2];
    var arrPopulation = data[3];
    var updateTime = data[4];

    // get update time from working group repository
    lastUpdated = updateTime.columns[0].replace('T', ' ').slice(0, -3) + ' GMT';

    // write last updated time to index page
    document.getElementById('last_update').innerHTML += ' <small class="text-muted">Data updated: ' + lastUpdated + '</small>';

    // create daily vaccinations per 100 column & reformatted date for sorting
    arrVaccinations.forEach(function(d) {
        d.daily_vaccinations_per_hundred = (d.daily_vaccinations_per_million / 10000).toFixed(3);
        d.dateSort = d.date.split('-').join('');
    });

    // get canada working group vaccine data for pre-jan 12 not included in owid dataset
    arrAdminCanada.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_administered);
        d.total_vaccinations_per_hundred = d.cumulative_avaccine / (37742157 / 100);
    });

    //TO DO: append arrAdminCanada to owid vaccine dataset to get pre jan 12 total per 100 data for the canada daily rank chart

    // created filtered vacDetail array excluding England, Gibralter, North Ireland, Scotland, Wales, World from vaccinations array
    const vacDetail = arrVaccinations.filter(function(d) { 
        return d.location != "England" && d.location != "European Union" && d.location != "Gibraltar" && d.location != "Northern Ireland" && d.location != "Isle of Man" && d.location != "Scotland" && d.location != "Wales" && d.location != "World";
    });

    // sort vacDetail array by location asc & date desc
    vacDetail.sort((a, b) => a.location.localeCompare(b.location) || a.dateSort - b.dateSort);

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

    // create owid_vaccine_alt, vaccines_group columns in arrLocations
    arrLocations.forEach(function(d) {
        d.owid_vaccine_alt = vaccineAlt(d.vaccines);
        d.vaccines_group = vaccineGroup(d.vaccines);
    });

    // left join arrPopulation to location
    const locationPop = equijoinWithDefault(
        arrLocations, arrPopulation, 
        "location", "country", 
        ({location, vaccines, owid_vaccine_alt, vaccines_group, last_observation_date}, {population}, ) => 
        ({location, vaccines, owid_vaccine_alt, vaccines_group, last_observation_date, population}), 
        {population:null});

    // left join locationPop to vaccinations
    const vacDetailLoc = equijoinWithDefault(
        vacDetail, locationPop, 
        "location", "location", 
        ({location, iso_code, date, total_vaccinations, people_vaccinated, people_fully_vaccinated, daily_vaccinations_raw, daily_vaccinations, total_vaccinations_per_hundred, total_vaccinations_per_hundred_filled, people_vaccinated_per_hundred, people_fully_vaccinated_per_hundred, daily_vaccinations_per_million, daily_vaccinations_per_hundred}, {vaccines, last_observation_date, owid_vaccine_alt, vaccines_group, population}, ) => 
        ({location, iso_code, date, total_vaccinations, people_vaccinated, people_fully_vaccinated, daily_vaccinations_raw, daily_vaccinations, total_vaccinations_per_hundred, total_vaccinations_per_hundred_filled, people_vaccinated_per_hundred, people_fully_vaccinated_per_hundred, daily_vaccinations_per_million, daily_vaccinations_per_hundred, vaccines, last_observation_date, owid_vaccine_alt, vaccines_group, population}), 
        {population: null});

    // filter vaccinations dataset by location max date to get current records only
    const vacCurrent = vacDetailLoc.filter(function(d) { 
        return d.date == d.last_observation_date;
    });


    // CREATE GLOBAL PER 100 BAR CHART
    function createGlobalPer100Chart() {
        // order vaccinationMaxDate desc by total_vaccinations_per_hundred
        vacCurrent.sort((a, b) => {
            return b.total_vaccinations_per_hundred_filled - a.total_vaccinations_per_hundred_filled;
        });

        // Create chart text content
        var canadaRank = vacCurrent.findIndex(x => x.location === "Canada") + 1;
        var canadaPer100 = vacCurrent.find(x => x.location === "Canada").total_vaccinations_per_hundred_filled;
        var countryCount = vacCurrent.length;

        // create divs, para for chart
        var divCanada = 'divWorld';
        var divTitle = document.createElement("h4");
        var divDesc= document.createElement("p");
        var divChart = document.createElement("div");
        divChart.id = divCanada;
        var chartTitle = "Global Total Doses per 100 People - Tracking How Canada Compares To Other Countries";
        var chartDesc = 'Shows Canada\'s relative ranking by total doses per 100 people compared to all countries currently in OWID dataset. Note over time, as OWID adds new countries to its dataset, Canada\'s past rank may change to account for new data.';
        divTitle.innerHTML  = chartTitle;
        divDesc.innerHTML  = chartDesc;
        document.getElementById('div_global_per100_chart').append(divTitle);
        document.getElementById('div_global_per100_chart').append(divDesc);
        document.getElementById('div_global_per100_chart').append(divChart);

        // create x and y axis data sets
        var x = [];
        var yPer100 = [];
 
        // create axes x and y arrays
        for (var i=0; i<vacCurrent.length; i++) {
            var row = vacCurrent[i];
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
            yaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false,
                tickmode: 'linear',
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
            title: {
                text:'Global Total Doses per 100 People <br> Canada ' + canadaPer100 + ' Ranks ' + canadaRank + ' of ' + countryCount + ' countries',
                font: {
                    size: 14
                },
            },
        }

        // plotly data, config, create chart
        var data = [trPer100];
        var config = {responsive: true}
        Plotly.newPlot('divWorld', data, layout, config);

    }


    // CREATE CANADA DAILY RANK PER 100 CHART
    function createCanadaDailyRankChart() {
        // create divs, para for Canada chart
        var divCanada = 'divCanadaRank';
        var divTitle = document.createElement("h4");
        var divDesc= document.createElement("p");
        var divChart = document.createElement("div");
        divChart.id = divCanada;
        var chartTitle = "Canada Daily Global Rank of Total Doses per 100 People - Tracking Canada's Changing Rank Relative To Other Countries";
        var chartDesc = 'Shows Canada\'s global rank and # countries in OWID dataset used in ranking by date. Note over time, as OWID adds new countries to its dataset, Canada\'s past rank may change to account for new data. Also while Canada has been administering vaccines since Dec 14, 2020, the Canadian government data source used by OWID only contains vaccination data starting Jan 12.';
        divTitle.innerHTML  = chartTitle;
        divDesc.innerHTML  = chartDesc;
        document.getElementById('div_canada_daily_rank_chart').append(divTitle);
        document.getElementById('div_canada_daily_rank_chart').append(divDesc);
        document.getElementById('div_canada_daily_rank_chart').append(divChart);

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
                    last_observation_date: d3.max(v, function(d) { return d.date; })
                };
            })
            .entries(vacDaily)
            .map(function(group) {
                return {
                    location: group.key,
                    last_observation_date: group.value.last_observation_date
                }
            });

            // create concat vacDaily location and date to join arrays
            vacDaily.forEach(function(d) {
                d.concatLocDate = d.location + d.date;
            });

            // create concat loopLocMaxDate location and date to join arrays
            loopLocMaxDate.forEach(function(d) {
                d.concatLocDate = d.location + d.last_observation_date;
            });
            
            // join loopLocMaxDate and vacDaily on concat location and date to get  total_vaccinations_per_hundred value from vacDaily for loop date
            loopLocMaxDate.forEach(function(d) {
                d.total_vaccinations_per_hundred_filled = vacDaily.find(x => x.concatLocDate === d.concatLocDate).total_vaccinations_per_hundred_filled;
            });
            
            // order loopLocMaxDate desc by total_vaccinations_per_hundred to get rank
            loopLocMaxDate.sort((a, b) => {
                return b.total_vaccinations_per_hundred_filled - a.total_vaccinations_per_hundred_filled;
            });

            // get rank only for post jan 11 dates eg owid Canada data only from jan 12
            if (loopDate.split('-').join('') > '20210111') {
                var canadaRank = loopLocMaxDate.findIndex(x => x.location === "Canada") + 1;
                yRank.push(canadaRank);
            } 
            // get x array and country count array for all dates
            x.push(loopDate);
            yCtryCount.push(loopLocMaxDate.length);
        }

         // get max values for y axis range 
         var maxRank = Math.max(...yRank);
         var maxCount = Math.max(...yCtryCount);

         // create chart traces
        var trGlobalRank = {
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

        var trRelRank = {
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

        // create chart layout
        var layout = {
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
                range:[0, 100],
                overlaying: 'y',
                side: 'right',
                showgrid: false,
                rangemode: 'tozero',
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false
            },
            autosize: true,
            autoscale: false,
            margin: {
                l: 40,
                r: 40,
                b: 80,
                t: 40,
                pad: 2
            },
            title: {
                text:'Canada Doses per 100 People <br> Daily Global Rank',
                font: {
                    size: 14
                },
            },
            showlegend: true,
            legend: {
                "orientation": "h",
                x: .3,
                xanchor: 'left',
                y: 1,
                bgcolor: clrWhiteTransparent,
                font: {
                    size: 10
                },
            },
        }

        // plotly data, config, create chart
        var data = [trGlobalRank, trRelRank, trCountryCount];
        var config = {responsive: true}
        Plotly.newPlot('divCanadaRank', data, layout, config);

    }


    // CREATE DAILY PER 100 CHART
    function createCanadaDailyPer100Chart() {
        // filter vaccinations current record dataset to Canada only
        var vacCurrentCanada = vacDetailLoc.filter(function(d) { 
            return d.location == "Canada";
        });

        // get current & previous daily doses per 100, calculate difference
        var currentDailyDP100 = vacCurrentCanada[vacCurrentCanada.length-1].daily_vaccinations_per_hundred;
        var previousDailyDP100 = vacCurrentCanada[vacCurrentCanada.length-2].daily_vaccinations_per_hundred;

        // create divs, para for Canada chart
        var divCanada = 'divCanada';
        var divTitle = document.createElement("h4");
        var divDesc= document.createElement("p");
        var divChart = document.createElement("div");
        divChart.id = divCanada;
        var chartTitle = "Canada Daily Doses per 100 People - Tracking Canada's Daily Dose Administration";
        var chartDesc = 'Shows Canada\'s absolute daily dose administration. Note: Canada has been administering vaccines since Dec 14, 2020 however the Canadian government data source used by OWID only contains vaccination data starting Jan 12.';
        divTitle.innerHTML  = chartTitle;
        divDesc.innerHTML  = chartDesc;
        document.getElementById('div_canada_daily_per100_chart').append(divTitle);
        document.getElementById('div_canada_daily_per100_chart').append(divDesc);
        document.getElementById('div_canada_daily_per100_chart').append(divChart);

        // create x and y axis data sets
        var x = [];
        var yPer100 = [];

        // create axes x and y arrays
        for (var i=0; i<vacCurrentCanada.length; i++) {
            var row = vacCurrentCanada[i];
            x.push(row['date']);
            yPer100.push(row['daily_vaccinations_per_hundred']);
        }

        // create chart traces
        var trPer100 = {
            name: 'Doses Per 100',
            hoverlabel: {
                namelength :-1
            },
            x: x,
            y: yPer100,
            showgrid: false,
            //fill: 'tozeroy',
            type: 'scatter',
            marker:{
                color: clrBlue
            },
        };

        // create chart layout
        var layout = {
            yaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false
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
            title: {
                text:'Canada Daily Doses per 100 People: <br>' + currentDailyDP100 + ' (' +  ((currentDailyDP100 < previousDailyDP100) ? 'Down' : 'Up') + ' From Previous Day ' + previousDailyDP100 + ')',
                font: {
                    size: 14
                },
            },
        }

        // plotly data, config, create chart
        var data = [trPer100];
        var config = {responsive: true}
        Plotly.newPlot('divCanada', data, layout, config);

    }

    // create charts when page loads
    createGlobalPer100Chart();
    createCanadaDailyRankChart();
    createCanadaDailyPer100Chart();

});


// FUNCTIONS

function getPercentile(arrRank, arrCtryCount) {
    results = [];
    for (var i=0; i<arrRank.length; i++) {
        results.push(parseInt((arrCtryCount[i] - arrRank[i] + 1) / arrCtryCount[i] * 100));
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
function reformatDate(oldDate) {
    // 17-12-2020 is working group date format
    var d = (oldDate).split('-');
    var newDate = d[2] + '-' + d[1] + '-' + d[0];
    return newDate
}

// lookup to return standard vaccine name
var vaccine_names  = [
    {orig_name: "CNBG, Sinovac", new_name: "Sinovac, CNBG"},
    {orig_name: "Covaxin, Covishield", new_name: "Covaxin, Covishield"},
    {orig_name: "Moderna, Pfizer/BioNTech", new_name: "Pfizer/BioNTech, Moderna"},
    {orig_name: "Oxford/AstraZeneca, Pfizer/BioNTech", new_name: "Pfizer/BioNTech, Oxford/AstraZeneca"},
    {orig_name: "Pfizer/BioNTech", new_name: "Pfizer/BioNTech"},
    {orig_name: "Pfizer/BioNTech, Sinopharm", new_name: "Pfizer/BioNTech, Sinopharm"},
    {orig_name: "Sinopharm", new_name: "Sinopharm"},
    {orig_name: "Sinovac", new_name: "Sinovac"},
    {orig_name: "Sputnik V", new_name: "Sputnik V"},
    {orig_name: "Pfizer/BioNTech, Pifzer/BioNTech", new_name: "Pfizer/BioNTech"}
]

// lookup to return alternate vaccine name
function vaccineAlt(vaccine) {
    var x = vaccine_names.find(x => x.orig_name === vaccine);
    if (typeof x === 'undefined'){
        new_name  = vaccine
    } else {
        new_name = x.new_name
    } 
    return new_name
}

// lookup to return alternate vaccine group
function vaccineGroup(vaccine) {
    if (vaccine.includes("Pfizer") || vaccine.includes("Moderna")) {
        return "Pfizer or Moderna"
    } {
        return "Not Pfizer or Moderna"
    }
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