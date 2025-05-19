/*
  Convert FIPS codes to postal codes
  - FIPS codes are 2-digit codes that identify US states and territories
  - Postal codes are the 2-letter abbreviations for US states
  - This mapping is used to convert FIPS codes to postal codes for display
  - The mapping is based on the US Census Bureau's FIPS code
*/
const fipsToPostal = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
  "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
  "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
  "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
  "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
  "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
  "55":"WI","56":"WY"
};


/*
  Convert state names to regions
  - This mapping is used to group states by region for visualization
*/
const vars = [
  { key: "TAVG",  label: "Avg Temp (°F)"        },
  { key: "PRCP",  label: "Precipitation (inches)" },
  { key: "AWND",  label: "Wind Speed (mph)"      },
  { key: "WDF5",  label: "Wind Direction (°)"    }
];

let currentVar = vars[0].key;
let yearlyVar = vars[0].key;

let futureState;
let kaggle;

/*
  Load data from CSV files and JSON file
  - The data is loaded using d3.csv() and d3.json()
  - The data is parsed using the parseRow() function
  - The data is then used to draw the current map, yearly chart, and forecast
  - The data is also used to create dropdowns for selecting the current variable,
    yearly variable, and future state
*/
Promise.all([
  d3.csv("data/weather.csv", parseRow),
  d3.csv("data/average_monthly_temperature_by_state_1950-2022.csv"),
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
]).then(([data, kaggleData, topo]) => {
  kaggle = kaggleData;
  const features = topojson.feature(topo, topo.objects.states).features;
  const states = Array.from(new Set(kaggleData.map(d => d.state))).sort();
  const stateOptions = states.map(s => ({key: s, label: s}));
  futureState = stateOptions[0].key;
  features.forEach(f => {
    const fips = f.id.toString().padStart(2, "0");
    f.properties.postal = fipsToPostal[fips];
  });

  makeDropdown("#current-section", "current-var-select", vars, currentVar, v => {
    currentVar = v;
    drawCurrent(data, features);
  });

  makeDropdown("#year-section", "yearly-var-select", vars, yearlyVar, v => {
    yearlyVar = v;
    drawYearly(data, features);
  });
  makeDropdown(
    "#future-section",
    "future-state-select",
    stateOptions,
    futureState,
    v => {
      futureState = v;
      forecastForState(kaggle,futureState);    
    }
  );

  d3.select("#future-section")
  .insert("label", "select#future-state-select")
    .style("margin", "0 1em")
    .html(`
      <input type="checkbox" id="future-tooltip-toggle" checked>
      Show markers &amp; tooltips
    `);
  
  // Draw the initial charts
  drawCurrent(data, features);
  drawYearly(data);
  forecastForState(kaggle, futureState);

});

/*
  parseRow(d):
  - Parses a row of data from the CSV file
  - Converts the date string to month and day integers
  - Converts the TMIN and TMAX strings to numbers
  - Calculates the average temperature (TAVG) from TMIN and TMAX
  - Returns an object with the parsed data
*/
function parseRow(d) {
  const tmin = +d.TMIN,
        tmax = +d.TMAX;
  const tavg = (tmin + tmax) / 2;

  return {
    month:  +d.date.substring(4,6),
    day:    +d.date.substring(6),
    state:  d.state,                       
    region: stateToRegion[d.state] || "Other",
    TAVG:   tavg,
    PRCP:  +d.PRCP,
    AWND:  +d.AWND,
    WDF5:  +d.WDF5,
  };
}

/*
  makeDropdown(container, id, options, initialKey, onChange):
  - Creates a dropdown menu for selecting a variable
  - `container`: the container element to insert the dropdown into
  - `id`: the id of the dropdown
  - `options`: the options for the dropdown
  - `initialKey`: the initial selected value
  - `onChange`: the function to call when the value changes
*/
function makeDropdown(container, id, options, initialKey, onChange) {
  const sel = d3.select(container)
    .insert("select", "svg")      
    .attr("id", id)
    .style("margin","0 1em");

  sel.selectAll("option")
    .data(options)
    .enter().append("option")
      .attr("value", d => d.key)
      .text(d => d.label)
      .property("selected", d => d.key === initialKey);

  sel.on("change", function() {
    onChange(this.value);
  });
}

/*
  drawCurrent(data, features):
  - Renders a map of the US with states colored by the selected variable
  - Uses D3.js to create the map and color the states
  - Adds tooltips for each state showing the average value of the selected variable
  - Adds a legend for the color scale
*/
function drawCurrent(data, features) {
  const w = 800, h = 500;
  const tooltip = d3.select("#tooltip");
  d3.select("#current-map").selectAll("*").remove();

  const svg = d3.select("#current-map")
    .append("svg").attr("width", w).attr("height", h);

  const projection = d3.geoAlbersUsa().scale(1000).translate([w/2,h/2]);
  const path = d3.geoPath(projection);

  
  const byState = d3.rollup(
    data,
    v => d3.mean(v, d => d[currentVar]),
    d => d.state
    );
  
  

  const temps = Array.from(byState.values());
  const minT  = d3.min(temps);
  const maxT  = Math.min(d3.max(temps), 100);
  const color = d3.scaleSequential(d3.interpolateYlOrRd)
    .domain([minT, maxT])
    .clamp(true);

  svg.append("g")
    .selectAll("path")
    .data(features)
    .join("path")
      .attr("d", path)
      .attr("fill", d => {
        const avg = byState.get(d.properties.postal);
        return avg != null ? color(avg) : "#ccc";
      })
      .attr("stroke", "#fff")
      .on("mouseover", (e, d) => {
        const avg = byState.get(d.properties.postal) || 0;
        tooltip
          .style("display", "block")
          .html(`<strong>${d.properties.name || d.properties.postal}</strong><br/>
                 ${vars.find(v=>v.key===currentVar).label}: ${avg.toFixed(1)}`);
      })
      .on("mousemove", e => {
        tooltip
          .style("left",  (e.pageX + 10) + "px")
          .style("top",   (e.pageY - 28) + "px");
      })
      .on("mouseout", () => tooltip.style("display", "none"));

  const legendWidth  = 300;
  const legendHeight = 8;
  const legendMargin = { top: 20, right: 20, bottom: 30, left: 20 };

  const legendG = svg.append("g")
    .attr(
      "transform",
      `translate(${w - legendWidth - 40}, ${h - legendMargin.bottom - legendHeight + 40})`
    );

  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "100%").attr("y2", "0%");

  const stopCount = 10;
  const domain    = color.domain();
  d3.range(stopCount).forEach(i => {
    const t = domain[0] + (domain[1] - domain[0]) * (i / (stopCount - 1));
    gradient.append("stop")
      .attr("offset", `${100 * i / (stopCount - 1)}%`)
      .attr("stop-color", color(t));
  });

  legendG.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)")
    .style("stroke", "#000")
    .style("stroke-width", "0.5");

  const legendScale = d3.scaleLinear()
    .domain(domain)
    .range([0, legendWidth]);

  const suffix = vars.find(v=>v.key===currentVar).label.match(/\(.+\)$/)[0];
  const legendAxis = d3.axisBottom(legendScale)
    .ticks(5)
    .tickFormat(d => d.toFixed(1) + suffix);

  legendG.append("g")
    .attr("transform", `translate(0, ${legendHeight})`)
    .call(legendAxis)
    .selectAll("text")
      .style("font-size", "10px");
}

/**
 * drawYearly(data):
 * Renders monthly mean trends by region for the selected variable.
 * - Rolls up data to region → month means
 * - Draws semi-transparent area + line + markers + tooltip interactions
 */
function drawYearly(data) {
  const w = 800,
        h = 400,
        margin = { top: 40, right: 120, bottom: 40, left: 130 };

  d3.select("#year-chart").selectAll("*").remove();

  const tooltip = d3.select("#tooltip");

  const svg = d3.select("#year-chart")
    .append("svg")
      .attr("width", w)
      .attr("height", h);

  const nested = d3.rollups(
    data,
    v => d3.mean(v, d => d[yearlyVar]),
    d => d.region,
    d => d.month
  );

  const series = nested.map(([region, arr]) => {
    const byMonth = new Map(arr);    
    const janVal = byMonth.get(1);
    const febVal = byMonth.get(2);

    const values = [];
    for (let m = 1; m <= 12; ++m) {
      let v = byMonth.get(m);
      if (v == null) {
        if (m === 11)      v = janVal;
        else if (m === 12) v = febVal;
        else               v = d3.mean(arr, ([_,vv]) => vv); 
      }
      values.push({ month: m, value: v });
    }

    return { region, values };
  });

  const x = d3.scaleLinear()
    .domain([1, 12])
    .range([margin.left, w - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(series, s => d3.max(s.values, d => d.value))])
    .nice()
    .range([h - margin.bottom, margin.top]);

  svg.append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(12).tickFormat(d => `M${d}`));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat(d => d.toFixed(1) + " " + vars.find(v=>v.key===yearlyVar).label));


  const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
    .domain(series.map(s => s.region));

  const areaGen = d3.area()
    .x(d => x(d.month))
    .y0(y(0))
    .y1(d => y(d.value));

  const lineGen = d3.line()
    .x(d => x(d.month))
    .y(d => y(d.value));

  series.forEach(s => {
    svg.append("path")
      .datum(s.values)
      .attr("fill",  colorScale(s.region))
      .attr("opacity", 0.2)
      .attr("d", areaGen);

    svg.append("path")
      .datum(s.values)
      .attr("fill", "none")
      .attr("stroke", colorScale(s.region))
      .attr("stroke-width", 2)
      .attr("d", lineGen);

      svg.append("g")
      .selectAll("circle")
      .data(s.values)
      .enter().append("circle")
        .attr("cx", d => x(d.month))
        .attr("cy", d => y(d.value))
        .attr("r", 3)
        .attr("fill", colorScale(s.region))
        .on("mouseover", (event, d) => {
          tooltip
            .style("display", "block")
            .html(
              `<strong>${s.region}</strong><br/>` +
              `M${d.month}: ${d.value.toFixed(1)} ${vars.find(v=>v.key===yearlyVar).label}`
            );
        })
        .on("mousemove", event => {
          tooltip
            .style("left",  (event.pageX + 10) + "px")
            .style("top",   (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
          tooltip.style("display", "none");
        });

  });

  const legend = svg.append("g")
    .attr("transform", `translate(${w - margin.right + 20},${margin.top})`);

  series.forEach((s, i) => {
    const g = legend.append("g")
      .attr("transform", `translate(0,${i * 20})`);
    g.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", colorScale(s.region));
    g.append("text")
      .attr("x", 16)
      .attr("y", 10)
      .style("font-size", "12px")
      .text(s.region);
  });
}

/**
 * forecastForState(kaggleData, futureState):
 * Trains a small MLP to forecast the next 60 months of average temperatures
 * for `futureState` using the past 12 months as input. Then calls drawForecast().
 * - `kaggleData`: the data from the Kaggle dataset
 * - `futureState`: the state to forecast
 * - `WINDOW`: the number of months to use as input for the model
 * - `σ`: the standard deviation of the residuals
 * - `xT`: the input tensor for the model
 * - `yT`: the output tensor for the model
 * - `model`: the trained model
 * - `yPred`: the predicted values
 * - `resid`: the residuals
 * - `forecast`: the forecasted values
 */

async function forecastForState(kaggleData, futureState) {
  const WINDOW = 12;

  const stateRows = kaggleData.filter(d => d.state === futureState);

  const monthly = Array.from(
    d3.rollups(
      stateRows,
      v => d3.mean(v, d => +d.average_temp),
      d => `${d.year}-${String(d.month).padStart(2, "0")}`
    ),
    ([ym, value]) => ({ ym, value })
  )
  .sort((a, b) => new Date(a.ym + "-01") - new Date(b.ym + "-01"));

  if (monthly.length <= WINDOW) {
    console.warn(`Not enough data to forecast for ${futureState}`);
    return;
  }

  const xs = [], ys = [];
  for (let i = 0; i + WINDOW < monthly.length; i++) {
    xs.push(monthly.slice(i, i + WINDOW).map(d => d.value));
    ys.push(monthly[i + WINDOW].value);
  }

  const xT = tf.tensor2d(xs, [xs.length, WINDOW]);
  const yT = tf.tensor1d(ys);

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 50, inputShape: [WINDOW], activation: "relu" }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: "adam", loss: "meanSquaredError" });
  await model.fit(xT, yT, { epochs: 80, batchSize: 32 });

  const yPred = Array.from(model.predict(xT).dataSync());
  const resid = ys.map((y, i) => y - yPred[i]);
  const σ = Math.sqrt(d3.mean(resid.map(r => r * r)));

  let window = monthly.slice(-WINDOW).map(d => d.value);
  const forecast = [];
  for (let i = 0; i < 60; i++) {
    const input = tf.tensor2d([window], [1, WINDOW]);
    const p = model.predict(input).dataSync()[0];
    forecast.push({ t: monthly.length + i + 1, value: p });
    window.push(p);
    window.shift();
  }

  drawForecast(
    monthly.map((d, i) => ({ t: i + 1, value: d.value })),
    forecast,
    σ
  );
}

/*
  * drawForecast(histArr, forecastArr, σ):
  * Renders the forecasted values for the next 60 months.
  * - `histArr`: the historical data
  * `forecastArr`: the forecasted data
  *`σ`: the standard deviation of the residuals
  * - Draws a line chart with the historical data, forecasted data, and a shaded area for ±1σ
  * - Adds tooltips for the historical and forecasted data points
  * - Adds a legend for the historical and forecasted data
  * - Adds a toggle to show/hide the markers and tooltips
*/
function drawForecast(histArr, forecastArr, σ) {
  const w = 800,
        h = 400,
        m = { top: 40, right: 40, bottom: 40, left: 50 };

  d3.select("#future-chart").selectAll("*").remove();

  const tooltip = d3.select("#tooltip");
  const showTips = d3.select("#future-tooltip-toggle").property("checked");

  const svg = d3.select("#future-chart")
    .append("svg")
      .attr("width", w)
      .attr("height", h);

  const all = histArr.concat(forecastArr);

  const x = d3.scaleLinear()
    .domain([1, all.length])
    .range([m.left, w - m.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(all, d => d.value)])
    .nice()
    .range([h - m.bottom, m.top]);

  const forecastLen = forecastArr.length;
  svg.append("g")
  .attr("transform", `translate(0,${h-m.bottom})`)
  .call(d3.axisBottom(x)
    .ticks(10)
    .tickFormat(d => d <= histArr.length ? `M${d}` : `+${forecastLen}`)
  )
  .selectAll("text")
    .attr("transform","rotate(-45)")
    .style("text-anchor","end");

  svg.append("g")
    .attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(y).tickFormat(d => d.toFixed(1) + "°F"));

  const ribbon = d3.area()
    .x(d => x(d.t))
    .y0(d => y(d.value - σ))
    .y1(d => y(d.value + σ));

  svg.append("path")
    .datum(forecastArr)
    .attr("fill", "#d62728")
    .attr("opacity", 0.2)
    .attr("d", ribbon);

  const line = d3.line()
    .x(d => x(d.t))
    .y(d => y(d.value));

  svg.append("path")
    .datum(histArr)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg.append("path")
    .datum(forecastArr)
    .attr("fill", "none")
    .attr("stroke", "#d62728")
    .attr("stroke-width", 2)
    .style("stroke-dasharray", "5,5")
    .attr("d", line);

  const histPts = svg.append("g").attr("class","marker-group historical");
  const fcstPts = svg.append("g").attr("class","marker-group forecast");

  histPts.selectAll("circle")
    .data(histArr)
    .join("circle")
      .attr("cx", d => x(d.t))
      .attr("cy", d => y(d.value))
      .attr("r", 3)
      .attr("fill", "#1f77b4")
      .on("mouseover", (e,d) => {
        d3.select("#tooltip")
          .style("display","block")
          .html(`<strong>Historical</strong><br/>M${d.t}: ${d.value.toFixed(1)}°F`);
      })
      .on("mousemove", e => {
        d3.select("#tooltip")
          .style("left",(e.pageX+10)+"px")
          .style("top",(e.pageY-28)+"px");
      })
      .on("mouseout", () => d3.select("#tooltip").style("display","none"));

  fcstPts.selectAll("circle")
    .data(forecastArr)
    .join("circle")
      .attr("cx", d => x(d.t))
      .attr("cy", d => y(d.value))
      .attr("r", 3)
      .attr("fill", "#d62728")
      .on("mouseover", (e,d) => {
        const offs = d.t - histArr.length;
        d3.select("#tooltip")
          .style("display","block")
          .html(`<strong>Forecast</strong><br/>+${offs}: ${d.value.toFixed(1)}°F`);
      })
      .on("mousemove", e => {
        d3.select("#tooltip")
          .style("left",(e.pageX+10)+"px")
          .style("top",(e.pageY-28)+"px");
      })
      .on("mouseout", () => d3.select("#tooltip").style("display","none"));

  d3.select("#future-tooltip-toggle").on("change", function() {
    const show = this.checked;
    histPts.style("display", show ? null : "none");
    fcstPts.style("display", show ? null : "none");
  });

  const legend = svg.append("g")
    .attr("class","future-legend")
    .attr("transform", `translate(${w - m.right - 0},${m.top-20})`);

  legend.append("line")
    .attr("x1", 0).attr("y1", 0)
    .attr("x2", 20).attr("y2", 0)
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 2);
  legend.append("text")
    .attr("x", 25).attr("y", 4)
    .style("font-size", "12px")
    .text("Historical");

  const fy = 20;
  legend.append("rect")
    .attr("x", 0).attr("y", fy-6)
    .attr("width", 20).attr("height", 8)
    .attr("fill", "#d62728")
    .attr("opacity", 0.2);
  legend.append("line")
    .attr("x1", 0).attr("y1", fy)
    .attr("x2", 20).attr("y2", fy)
    .attr("stroke", "#d62728")
    .attr("stroke-width", 2)
    .style("stroke-dasharray", "5,5");
  legend.append("text")
    .attr("x", 25).attr("y", fy+4)
    .style("font-size", "12px")
    .text("Forecast ±1σ");
}