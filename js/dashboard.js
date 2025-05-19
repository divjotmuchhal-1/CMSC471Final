// js/dashboard.js
// Full Climate Variability Dashboard (all temps in °F)

// 1) FIPS → Postal
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

const vars = [
  { key: "TAVG",  label: "Avg Temp (°F)"        },
  { key: "PRCP",  label: "Precipitation (inches)" },
  { key: "AWND",  label: "Wind Speed (mph)"      },
  { key: "WDF5",  label: "Wind Direction (°)"    }
];

// current selections
let currentVar = vars[0].key;
let yearlyVar = vars[0].key;

let futureState;
let kaggle;
// 2) Load data & TopoJSON
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
      forecastForState(kaggle,futureState);    // re‐train & redraw for the newly selected state
    }
  );

  d3.select("#future-section")
  .insert("label", "select#future-state-select")
    .style("margin", "0 1em")
    .html(`
      <input type="checkbox" id="future-tooltip-toggle" checked>
      Show markers &amp; tooltips
    `);

  drawCurrent(data, features);
  drawYearly(data);
  //trainAndForecast(kaggleData);
  forecastForState(kaggle, futureState);

});


// 3) Parse + convert TAVG to °F
function parseRow(d) {
  // if your raw TMIN/TMAX are in °C, convert to °F:  F = C*9/5 + 32
  const tmin = +d.TMIN,
        tmax = +d.TMAX;
  // compute average and keep everything in °F
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
function makeDropdown(container, id, options, initialKey, onChange) {
  const sel = d3.select(container)
    .insert("select", "svg")      // put it just before the svg
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
// 4) Current Snapshot: full-year average per state
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
  
  // roll up across the entire dataset (all 365 days)  
  

  // clamp our color scale at [min…100] °F
  const temps = Array.from(byState.values());
  const minT  = d3.min(temps);
  const maxT  = Math.min(d3.max(temps), 100);
  const color = d3.scaleSequential(d3.interpolateYlOrRd)
    .domain([minT, maxT])
    .clamp(true);

  // draw the map
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

  // —— LEGEND (moved down slightly) —— //
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

// 5) Yearly Trends
function drawYearly(data) {
  const w = 800,
        h = 400,
        margin = { top: 40, right: 120, bottom: 40, left: 130 };

  // clear old chart
  d3.select("#year-chart").selectAll("*").remove();

  const tooltip = d3.select("#tooltip");

  const svg = d3.select("#year-chart")
    .append("svg")
      .attr("width", w)
      .attr("height", h);

  // 1) roll up to region → month → mean TAVG
  const nested = d3.rollups(
    data,
    v => d3.mean(v, d => d[yearlyVar]),
    d => d.region,
    d => d.month
  );

  // 2) for each region, build a full 1–12 array, padding 11←Jan, 12←Feb
  const series = nested.map(([region, arr]) => {
    const byMonth = new Map(arr);    // e.g. Map {1→32.1, 2→35.2, …9→68.4}
    const janVal = byMonth.get(1);
    const febVal = byMonth.get(2);

    const values = [];
    for (let m = 1; m <= 12; ++m) {
      let v = byMonth.get(m);
      if (v == null) {
        if (m === 11)      v = janVal;
        else if (m === 12) v = febVal;
        else               v = d3.mean(arr, ([_,vv]) => vv); 
        // fallback: use annual mean for any other missing
      }
      values.push({ month: m, value: v });
    }

    return { region, values };
  });

  // 3) scales
  const x = d3.scaleLinear()
    .domain([1, 12])
    .range([margin.left, w - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(series, s => d3.max(s.values, d => d.value))])
    .nice()
    .range([h - margin.bottom, margin.top]);

  // 4) axes
  svg.append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(12).tickFormat(d => `M${d}`));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat(d => d.toFixed(1) + " " + vars.find(v=>v.key===yearlyVar).label));


  // 5) area + line
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

  // 6) legend
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

// 6) trainAndForecast: simple RNN → 5-year forecast
async function trainAndForecast(kaggleData) {
  // A) compute U.S.-wide monthly mean (1950→2022)
  const monthly = Array.from(
    d3.rollups(
      kaggleData,
      v => d3.mean(v, d => +d.average_temp),
      d => d.year + "-" + d.month.toString().padStart(2,"0")
    ),
    ([ym, val]) => ({ ym, value: val })
  );
  monthly.sort((a,b)=>new Date(a.ym+"-01") - new Date(b.ym+"-01"));

  // B) sliding window: past 12 → next 1
  const WINDOW = 12, xs = [], ys = [];
  for (let i=0; i+WINDOW<monthly.length; i++){
    xs.push(monthly.slice(i,i+WINDOW).map(d=>d.value));
    ys.push(monthly[i+WINDOW].value);
  }
  const xT = tf.tensor2d(xs), yT = tf.tensor1d(ys);

  // C) build & train
  const model = tf.sequential();
  model.add(tf.layers.dense({ units:50, inputShape:[WINDOW], activation:"relu" }));
  model.add(tf.layers.dense({ units:1 }));
  model.compile({ optimizer:"adam", loss:"meanSquaredError" });
  await model.fit(xT, yT, { epochs:80, batchSize:32 });

  // D) forecast 60 months
  let window = monthly.slice(-WINDOW).map(d=>d.value);
  const forecast = [];
  for (let i=0; i<60; i++){
    const pred = model.predict(tf.tensor2d([window],[1,WINDOW]))
                     .dataSync()[0];
    forecast.push({ t: monthly.length + i + 1, value: pred });
    window.push(pred); window.shift();
  }
   const yPred = model.predict(xT).dataSync();
  const resid = ys.map((y,i) => y - yPred[i]);
  const σ     = Math.sqrt(d3.mean(resid.map(r => r*r)));

  // D) roll‐forward your 60‐month forecast as before…
  // let forecast = [ {t:…, value:…}, … ];

  // E) draw the panel, now passing σ
  drawForecast(
    monthly.map((d,i) => ({ t: i+1,    value: d.value   })), 
    forecast, 
    σ
  );
}

// 7) drawForecast: ribbon + line
// 7) drawForecast: ribbon + lines
/*
function drawForecast(histArr, forecastArr, σ) {
  const w = 800, h = 400;
  const margin = { top:40, right:40, bottom:40, left:50 };

  // clear & svg setup
  d3.select("#future-chart").selectAll("*").remove();
  const svg = d3.select("#future-chart")
    .append("svg").attr("width",w).attr("height",h);

  // scales over history + forecast
  const all = histArr.concat(forecastArr);
  const x = d3.scaleLinear().domain([1, all.length])
              .range([margin.left, w - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(all,d=>d.value)]).nice()
              .range([h - margin.bottom, margin.top]);

  // axes
  svg.append("g")
    .attr("transform",`translate(0,${h-margin.bottom})`)
    .call(d3.axisBottom(x)
      .tickValues([1,12,24,36,48,60, all.length])
      .tickFormat(d => d <= histArr.length
        ? `M${d}` : `+${d - histArr.length}`));
  svg.append("g")
    .attr("transform",`translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat(d=>d.toFixed(1)+"°F"));

  // 1σ ribbon around the forecast
  const ribbonGen = d3.area()
    .x(d => x(d.t))
    .y0(d => y(d.value - σ))
    .y1(d => y(d.value + σ));

  svg.append("path")
    .datum(forecastArr)
    .attr("fill",    "#d62728")
    .attr("opacity", 0.2)
    .attr("d",       ribbonGen);

  // historical line
  const line = d3.line()
    .x(d=>x(d.t))
    .y(d=>y(d.value));

  svg.append("path")
    .datum(histArr)
    .attr("fill","none")
    .attr("stroke","#1f77b4")
    .attr("stroke-width",2)
    .attr("d", line);

  // forecast dashed line
  svg.append("path")
    .datum(forecastArr)
    .attr("fill","none")
    .attr("stroke","#d62728")
    .attr("stroke-width",2)
    .style("stroke-dasharray","5,5")
    .attr("d", line);
}*/

async function forecastForState(kaggleData, futureState) {
  const WINDOW = 12;

  // A) grab only rows for the selected state (capital “State” field)
  const stateRows = kaggleData.filter(d => d.state === futureState);

  // B) compute monthly means keyed by "YYYY-MM"
  const monthly = Array.from(
    d3.rollups(
      stateRows,
      v => d3.mean(v, d => +d.average_temp),
      d => `${d.year}-${String(d.month).padStart(2, "0")}`
    ),
    ([ym, value]) => ({ ym, value })
  )
  // sort chronologically
  .sort((a, b) => new Date(a.ym + "-01") - new Date(b.ym + "-01"));

  // need at least WINDOW+1 months to train
  if (monthly.length <= WINDOW) {
    console.warn(`Not enough data to forecast for ${futureState}`);
    return;
  }

  // C) sliding window: past WINDOW → next month
  const xs = [], ys = [];
  for (let i = 0; i + WINDOW < monthly.length; i++) {
    xs.push(monthly.slice(i, i + WINDOW).map(d => d.value));
    ys.push(monthly[i + WINDOW].value);
  }

  // D) build tensors with explicit shapes
  const xT = tf.tensor2d(xs, [xs.length, WINDOW]);
  const yT = tf.tensor1d(ys);

  // E) define and train a tiny dense net
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 50, inputShape: [WINDOW], activation: "relu" }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: "adam", loss: "meanSquaredError" });
  await model.fit(xT, yT, { epochs: 80, batchSize: 32 });

  // F) compute σ of residuals
  const yPred = Array.from(model.predict(xT).dataSync());
  const resid = ys.map((y, i) => y - yPred[i]);
  const σ = Math.sqrt(d3.mean(resid.map(r => r * r)));

  // G) roll‐forward forecast 60 months
  let window = monthly.slice(-WINDOW).map(d => d.value);
  const forecast = [];
  for (let i = 0; i < 60; i++) {
    const input = tf.tensor2d([window], [1, WINDOW]);
    const p = model.predict(input).dataSync()[0];
    forecast.push({ t: monthly.length + i + 1, value: p });
    window.push(p);
    window.shift();
  }

  // H) draw the historical + forecast ribbon chart
  drawForecast(
    monthly.map((d, i) => ({ t: i + 1, value: d.value })),
    forecast,
    σ
  );
}

function drawForecast(histArr, forecastArr, σ) {
  const w = 800,
        h = 400,
        m = { top: 40, right: 40, bottom: 40, left: 50 };

  // 1) clear out any previous chart
  d3.select("#future-chart").selectAll("*").remove();

  const tooltip = d3.select("#tooltip");
  const showTips = d3.select("#future-tooltip-toggle").property("checked");
  // 2) append new SVG
  const svg = d3.select("#future-chart")
    .append("svg")
      .attr("width", w)
      .attr("height", h);

  // 3) build combined array for scale domains
  const all = histArr.concat(forecastArr);

  // 4) x-scale is just the index 1…all.length
  const x = d3.scaleLinear()
    .domain([1, all.length])
    .range([m.left, w - m.right]);

  // 5) y-scale based on min/max temperature
  const y = d3.scaleLinear()
    .domain([0, d3.max(all, d => d.value)])
    .nice()
    .range([h - m.bottom, m.top]);

  // 6) bottom axis: show month index (M1…M(histArr.length), then +1…+60)
  svg.append("g")
  .attr("transform", `translate(0,${h-m.bottom})`)
  .call(d3.axisBottom(x)
    .ticks(10)
    .tickFormat(d => d <= histArr.length ? `M${d}` : `+${d - histArr.length}`)
  )
  .selectAll("text")
    .attr("transform","rotate(-45)")
    .style("text-anchor","end");

  // 7) left axis: temperature
  svg.append("g")
    .attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(y).tickFormat(d => d.toFixed(1) + "°F"));

  // 8) ribbon generator for ±1σ around forecast
  const ribbon = d3.area()
    .x(d => x(d.t))
    .y0(d => y(d.value - σ))
    .y1(d => y(d.value + σ));

  // 9) draw ribbon (forecast only)
  svg.append("path")
    .datum(forecastArr)
    .attr("fill", "#d62728")
    .attr("opacity", 0.2)
    .attr("d", ribbon);

  // 10) line generator
  const line = d3.line()
    .x(d => x(d.t))
    .y(d => y(d.value));

  // 11) draw historical line (solid blue)
  svg.append("path")
    .datum(histArr)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 2)
    .attr("d", line);

  // 12) draw forecast line (dashed red)
  svg.append("path")
    .datum(forecastArr)
    .attr("fill", "none")
    .attr("stroke", "#d62728")
    .attr("stroke-width", 2)
    .style("stroke-dasharray", "5,5")
    .attr("d", line);

  // 1) create two groups for points/tooltips
  const histPts = svg.append("g").attr("class","marker-group historical");
  const fcstPts = svg.append("g").attr("class","marker-group forecast");

  // 2) draw historical circles
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

  // 3) draw forecast circles
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

  // 4) hook up the toggle checkbox
  d3.select("#future-tooltip-toggle").on("change", function() {
    const show = this.checked;
    // show/hide both groups
    histPts.style("display", show ? null : "none");
    fcstPts.style("display", show ? null : "none");
  });

  const legend = svg.append("g")
    .attr("class","future-legend")
    // position it inside the top-right margin
    .attr("transform", `translate(${w - m.right - 0},${m.top-20})`);

  // historical
  legend.append("line")
    .attr("x1", 0).attr("y1", 0)
    .attr("x2", 20).attr("y2", 0)
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 2);
  legend.append("text")
    .attr("x", 25).attr("y", 4)
    .style("font-size", "12px")
    .text("Historical");

  // forecast
  const fy = 20;
  // ribbon swatch
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