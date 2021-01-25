
// get csv files from OWID github repository
var file_update_time = "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data-last-updated-timestamp.txt";

var file_vaccinations = "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/vaccinations.csv";

var file_locations = "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/locations.csv";

// owid population file
//var file_population = "https://raw.githubusercontent.com/owid/covid-19-data/master/scripts/input/un/population_2020.csv"; 

// population file
var file_population = "https://raw.githubusercontent.com/sitrucp/covid_global_vaccinations/master/population.csv";

Promise.all([
    d3.csv(file_vaccinations),
    d3.csv(file_locations),
    d3.csv(file_population),
    d3.csv(file_update_time)
]).then(function(data) {
    //everthing else below is in d3 promise scope

    // get data sets from promise
    var vaccinations = data[0];
    var locations = data[1];
    var population = data[2];
    var updateTime = data[3];

    // get update time from working group repository
    lastUpdated = updateTime.columns[0];
    
    document.getElementById('title').innerHTML += ' <small class="text-muted">Last updated: ' + lastUpdated + '</small>';

    // create daily vaccinations per 100 column
    vaccinations.forEach(function(d) {
        d.daily_vaccinations_per_hundred = (d.daily_vaccinations_per_million / 10000).toFixed(3);
    });

    // filter England, Gibralter, North Ireland, Scotland, Wales, World from vaccinations
    const vacDetail = vaccinations.filter(function(d) { 
        return d.location != "England" && d.location != "Gibraltar" && d.location != "Northern Ireland" && d.location != "Scotland" && d.location != "Wales" && d.location != "World" && d.location != "European Union";
    });

    // create owid_vaccine_alt, vaccines_group columns in locations
    locations.forEach(function(d) {
        d.owid_vaccine_alt = vaccineAlt(d.vaccines);
        d.vaccines_group = vaccineGroup(d.vaccines);
    });

    // left join population to location
    const locationPop = equijoinWithDefault(
        locations, population, 
        "location", "country", 
        ({location, vaccines, owid_vaccine_alt, vaccines_group, last_observation_date}, {population}, ) => 
        ({location, vaccines, owid_vaccine_alt, vaccines_group, last_observation_date, population}), 
        {population:null});

    // left join locationPop to vaccinations
    const vacDetailLoc = equijoinWithDefault(
        vacDetail, locationPop, 
        "location", "location", 
        ({location, iso_code, date, total_vaccinations, people_vaccinated, people_fully_vaccinated, daily_vaccinations_raw, daily_vaccinations, total_vaccinations_per_hundred, people_vaccinated_per_hundred, people_fully_vaccinated_per_hundred, daily_vaccinations_per_million, daily_vaccinations_per_hundred}, {vaccines, last_observation_date, owid_vaccine_alt, vaccines_group, population}, ) => 
        ({location, iso_code, date, total_vaccinations, people_vaccinated, people_fully_vaccinated, daily_vaccinations_raw, daily_vaccinations, total_vaccinations_per_hundred, people_vaccinated_per_hundred, people_fully_vaccinated_per_hundred, daily_vaccinations_per_million, daily_vaccinations_per_hundred, vaccines, last_observation_date, owid_vaccine_alt, vaccines_group, population}), 
        {population: null});

    // filter vaccinations dataset by location max date to get current records only
    const vacCurrent = vacDetailLoc.filter(function(d) { 
        return d.date == d.last_observation_date;
    });

    function createGlobalPer100Chart() {

        // CREATE PER 100 CHART
        // order vaccinationMaxDate desc by total_vaccinations_per_hundred
        vacCurrent.sort((a, b) => {
            return b.total_vaccinations_per_hundred - a.total_vaccinations_per_hundred;
        });

        // Create chart text content
        var canadaRank = vacCurrent.findIndex(x => x.location ==="Canada") + 1;
        var canadaPer100 = vacCurrent.find(x => x.location === "Canada").total_vaccinations_per_hundred;

        // create divs, para for Canada chart
        var divWorld = 'divWorld';
        var divTitle = divWorld + 'Title';
        var divText = document.createElement("h4");
        var divChart = document.createElement("div");
        divChart.id = divWorld;
        divText.id = divTitle;
        var chartDetails = 'Global Ranking Of Total Doses Per 100 Persons: Tracking How Canada Compares to Other Countries';

        divText.innerHTML  = chartDetails;
        document.getElementById('div_world_total_per100_chart').append(divText);
        document.getElementById('div_world_total_per100_chart').append(divChart);

        // create x and y axis data sets
        var x = [];
        var yPer100 = [];
 
        // create axes x and y arrays
        for (var i=0; i<vacCurrent.length; i++) {
            var row = vacCurrent[i];
            x.push(row['location']);
            yPer100.push(row['total_vaccinations_per_hundred']);
        }

        var per100 = {
            name: 'Doses Per 100',
            x: x,
            y: yPer100,
            showgrid: false,
            fill: 'tozeroy',
            type: 'bar',
            marker:{
                color: fillColor(x)
            },
        };

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
            //width: 600,
            //height: 300,
            margin: {
                l: 40,
                r: 40,
                b: 120,
                t: 40,
                pad: 2
            },
            title: {
                text:'Global Total Doses Per 100 Persons: Canada Ranks #' + canadaRank + ' at ' + canadaPer100,
                font: {
                    weight: 'bold',
                    size: 14,
                    family: 'Arial, Helvetica, sans-serif',
                },
            },
        }

        var data = [per100];
        Plotly.newPlot('divWorld', data, layout);

    }

    function createCanadaPer100Chart() {

        // CREATE PER 100 CHART

        // filter vaccinations current record dataset to Canada only
        var vacCurrentCanada = vacDetailLoc.filter(function(d) { 
            return d.location == "Canada";
        });

        // get current daily doses per 100
        var currentDailyDP100 = vacCurrentCanada[vacCurrentCanada.length-1].daily_vaccinations_per_hundred;
        var previousDailyDP100 = vacCurrentCanada[vacCurrentCanada.length-2].daily_vaccinations_per_hundred;
        var diffDailyDP100 = currentDailyDP100 - previousDailyDP100

        // create divs, para for Canada chart
        var divCanada = 'divCanada';
        var divTitle = divCanada + 'Title';
        var divText = document.createElement("h4");
        var divChart = document.createElement("div");
        divChart.id = divCanada;
        divText.id = divTitle;
        var chartDetails = "Canada Daily Doses Per 100 Persons: Tracking Canada's Daily Dose Administration";

        divText.innerHTML  = chartDetails;
        document.getElementById('div_canada_daily_per100_chart').append(divText);
        document.getElementById('div_canada_daily_per100_chart').append(divChart);

        // create x and y axis data sets
        var x = [];
        var yPer100 = [];
 
        // create axes x and y arrays
        for (var i=0; i<vacCurrentCanada.length; i++) {
            var row = vacCurrentCanada[i];
            x.push(row['date']);
           // yPer100.push((row['daily_vaccinations_per_million'] / 10000).toFixed(3));
            yPer100.push(row['daily_vaccinations_per_hundred']);
        }

        var per100 = {
            name: 'Doses Per 100',
            x: x,
            y: yPer100,
            showgrid: false,
            //fill: 'tozeroy',
            type: 'scatter',
            marker:{
                color: fillColor(x)
            },
        };

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
            //width: 600,
            //height: 300,
            margin: {
                l: 30,
                r: 40,
                b: 80,
                t: 40,
                pad: 2
            },
            title: {
                text:'Canada Daily Doses Per 100 Persons: ' + currentDailyDP100 + ' (' +  ((currentDailyDP100 < previousDailyDP100) ? 'Down' : 'Up') + ' From Previous Day ' + previousDailyDP100 + ')',
                font: {
                    weight: 'bold',
                    size: 14,
                    family: 'Arial, Helvetica, sans-serif',
                },
            },
        }

        var data = [per100];
        Plotly.newPlot('divCanada', data, layout);

    }

    function createCanadaDailyRankChart() {

        // CREATE CANADA DAILY RANK PER 100 CHART

        // filter vaccinations current record dataset to Canada only
        var vacCurrentCanada = vacDetailLoc.filter(function(d) { 
            return d.location == "Canada";
        });

        // create vacDates array with unique dates
        const vacDates = [...new Set(vacDetailLoc.map(item => item.date))];

        // sort vacDates array desc order
        vacDates.sort(function(a,b) {
            a = a.split('-').join('');
            b = b.split('-').join('');
            //return a > b ? 1 : a < b ? -1 : 0; // asc
            return a < b ? 1 : a > b ? -1 : 0; // desc
        });

        // create divs, para for Canada chart
        var divCanada = 'divCanadaRank';
        var divTitle = divCanada + 'Title';
        var divText = document.createElement("h4");
        var divChart = document.createElement("div");
        divChart.id = divCanada;
        divText.id = divTitle;
        var chartDetails = "Canada Total Doses Per 100 Persons Daily Global Rank: Tracking Canada's Changing Rank Relative To Other Countries";

        divText.innerHTML  = chartDetails;
        document.getElementById('div_canada_daily_per100_rank_chart').append(divText);
        document.getElementById('div_canada_daily_per100_rank_chart').append(divChart);

        // create x and y axis data sets
        var x = [];
        var yPer100 = [];
        var yRank = [];
        var yCount = [];
        var yPctile = [];
        var yPctileSorted = [];

        // loop through vacDates, get date and rank, per day into new array
        // loop through vacDates desc, get max date per country, that is less than loop date
        // assign max date less than loop date as country's last report date

        for (var i=0; i<vacDates.length; i++) {
            var loopDate = vacDates[i];

            // filter vacDetailLoc to dates less than loop date
            var vacDaily = vacDetailLoc.filter(function(d) { 
                return d.date <= loopDate;
            });

            // summarize location by loop date country's max date
            // recreate equivalent of each day's last observation date
            var loopLocMaxDate = d3.nest()
            .key(function(d) { return d.location; })
            .rollup(function(v) { return {
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

            // concat vacDaily location and date
            vacDaily.forEach(function(d) {
                d.concatLocDate = d.location + d.date;
            });

            // concat loopLocMaxDate location and date
            loopLocMaxDate.forEach(function(d) {
                d.concatLocDate = d.location + d.last_observation_date;
            });
            
            // get total_vaccinations_per_hundred for loopLocMaxDate location and date
            loopLocMaxDate.forEach(function(d) {
                d.total_vaccinations_per_hundred = vacDaily.find(x => x.concatLocDate === d.concatLocDate).total_vaccinations_per_hundred;
            });

            // order loopLocMaxDate desc by total_vaccinations_per_hundred to get rank
            loopLocMaxDate.sort((a, b) => {
                return b.total_vaccinations_per_hundred - a.total_vaccinations_per_hundred;
            });

            // get loopLocMaxDate location rank
            var canadaRank = loopLocMaxDate.findIndex(x => x.location === "Canada") + 1;
            var canadaPer100 = loopLocMaxDate.find(x => x.location === "Canada").total_vaccinations_per_hundred;

            // add loopLocMaxDate x and y to chart array
            x.push(loopDate);
            yRank.push(canadaRank);
            yPer100.push(canadaPer100);
            yCount.push(loopLocMaxDate.length);

            var maxRank = Math.max(...yRank);
            var maxCount = Math.max(...yCount);
            var maxPer100 = Math.max(...yPer100);

            /*
            // sort yPctile values asc to use them to calculate percentile
            var yRankSorted = yRank.sort((a, b) => {
                return a - b;
            });

            // loop through yPctile asc to find first value greater than canadaRank
            for (var i=1; i<yRankSorted.length; i++) {
                console.log(i, yRankSorted[i], canadaRank, yRankSorted.length);
                if (yRankSorted[i] > canadaRank) {
                    var pctile = parseInt((i / yRankSorted.length) * 100);
                    break;
                }
            }
            yPctile.push(pctile);
            */
        }

        var globalRank = {
            name: 'Global Rank',
            x: x,
            y: yRank,
            //showgrid: false,
            type: 'scatter',
            marker:{
                color: fillColor(x)
            },
        };

        var countryCount = {
            name: 'Doses Per 100 Persons',
            x: x,
            y: yPer100,
            yaxis: 'y2',
            //showgrid: false,
            type: 'bar',
            marker:{
                color: 'rgba(204,204,204, .9)' // gray
            },
        };

        var layout = {
            yaxis: { 
                title: {
                    text: 'Canada Global Rank',
                    font: {
                        size: 12,
                        family: 'Arial, Helvetica, sans-serif',
                        color: '#333',
                    },
                },
                tickfont: {
                    size: 11
                },
                range:[0, roundUp10(maxRank)],
                showgrid: false,
                overlaying: 'y2',
            },
            yaxis2: {
                title: {
                    text: 'Doses Per 100 Persons',
                    font: {
                        size: 12,
                        family: 'Arial, Helvetica, sans-serif',
                        color: '#333',
                    },
                },
                tickfont: {
                    size: 11
                },
                range:[0, maxPer100],
                showgrid: false,
                // overlaying: 'y',
                side: 'right'
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false
            },
            autosize: true,
            autoscale: false,
            //width: 600,
            //height: 300,
            margin: {
                l: 40,
                r: 40,
                b: 80,
                t: 40,
                pad: 2
            },
            title: {
                text:'Canada Global Ranking of Doses Per 100 Persons',
                font: {
                    weight: 'bold',
                    size: 14,
                    family: 'Arial, Helvetica, sans-serif',
                },
            },
            showlegend: true,
            legend: {
                "orientation": "h",
                x: .3,
                xanchor: 'left',
                y: 1,
                bgcolor: 'rgba(0,0,0,0)',
                font: {
                    family: 'Arial, Helvetica, sans-serif',
                    size: 10,
                    color: '#666',
                },
            },
        }

        var data = [globalRank, countryCount];
        Plotly.newPlot('divCanadaRank', data, layout);

    }

    // call charts when page loads
    createGlobalPer100Chart();
    createCanadaPer100Chart();
    createCanadaDailyRankChart();

});

// functions

function rankPercentile(arrLen, rank) {
    

    return percentile
}

function roundUp10(x) {
        return Math.ceil(x / 10) * 10;
}

// left join function used to join datasets
function equijoinWithDefault(xs, ys, primary, foreign, sel, def) {
    const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
    return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
}

// reformat date to date object
function reformatDate(oldDate) {
    // 17-12-2020 is working group date format
    var d = (oldDate).split('-');
    var newDate = new Date(d[1] + '/' + d[0] + '/' + d[2]);
    return newDate
}

// lookup array to return standard vaccine name
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

function vaccineAlt(vaccine) {
    var x = vaccine_names.find(x => x.orig_name === vaccine);
    if (typeof x === 'undefined'){
        new_name  = vaccine
    } else {
        new_name = x.new_name
    } 
    return new_name
}

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
            colors.push('rgba(49,130,189, .9)'); // blue
        } else {
            colors.push('rgba(204,204,204, .9)'); // gray
        }
    }
    return colors
}

function hideShowDiv(id) {
   var e = document.getElementById(id);
   if(e.style.display == 'block')
      e.style.display = 'none';
   else
      e.style.display = 'block';
}