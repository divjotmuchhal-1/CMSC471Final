
let allData = [];
let xVar = 'temperature', yVar = 'precipitation', sizeVar = 'windSpeed';
let targetMonth = 1, targetDay = 1;
let regionVar = "All Regions"; 
let brushingMode = false;  

const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;
const t = 1000; 

const options = ['temperature', 'windDirection', 'precipitation', 'windSpeed'];
const colorScale = d3.scaleOrdinal()
  .domain(["East Coast", "Midwest", "Central", "Pacific", "Other"])
  .range(["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00"]);

const stateToRegion = {
  "ME": "East Coast",
  "NH": "East Coast",
  "VT": "East Coast",
  "MA": "East Coast",
  "RI": "East Coast",
  "CT": "East Coast",
  "NY": "East Coast",
  "NJ": "East Coast",
  "DE": "East Coast",
  "MD": "East Coast",
  "VA": "East Coast",
  "NC": "East Coast",
  "SC": "East Coast",
  "GA": "East Coast",
  "FL": "East Coast",
  "OH": "Midwest",
  "MI": "Midwest",
  "IN": "Midwest",
  "IL": "Midwest",
  "WI": "Midwest",
  "MO": "Midwest",
  "IA": "Midwest",
  "MN": "Midwest",
  "KS": "Midwest",
  "NE": "Midwest",
  "SD": "Midwest",
  "ND": "Midwest",
  "TX": "Central",
  "OK": "Central",
  "AR": "Central",
  "LA": "Central",
  "MS": "Central",
  "AL": "Central",
  "KY": "Central",
  "TN": "Central",
  "WA": "Pacific",
  "OR": "Pacific",
  "CA": "Pacific",
  "AK": "Pacific",
  "HI": "Pacific"
};

const svg = d3.select('#vis')
  .append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

svg.append("defs")
.append("clipPath")
.attr("id", "clip")
.append("rect")
.attr("width", width)
.attr("height", height);

const mainGroup = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const gXAxis = mainGroup.append("g")
  .attr("class", "x-axis")
  .attr("transform", `translate(0,${height})`);
const gYAxis = mainGroup.append("g")
  .attr("class", "y-axis");

const gPoints = mainGroup.append("g")
  .attr("class", "points-group")
  .attr("clip-path", "url(#clip)");


let xScale, yScale, sizeScale;

let brush;      
let gBrush;     
let currentXScale, currentYScale; 

const zoom = d3.zoom()
  .scaleExtent([0.5, 5])
  .on("zoom", zoomed);

function init() {
  d3.csv('data/weather.csv', function(d) {
    return {
      date: +d.date,
      year: +(d.date.substring(0, 4)),
      month: +(d.date.substring(4, 6)),
      day: +(d.date.substring(6)),
      temperature: +d.TAVG,
      windDirection: +d.WDF5,
      windSpeed: +d.AWND,
      precipitation: +d.PRCP,
      station: d.station,
      state: d.state,
      region: stateToRegion[d.state] || "Other"  
    };
  })
  .then(data => {
    allData = data;
    console.log(allData);
    setupSelector();
    updateAxes();
    updateVis();
    updateBrushOverlay();
  })
  .catch(error => console.error('Error loading data:', error));
}

window.addEventListener('load', init);

function setupSelector() {
  var slider = d3.sliderHorizontal()
    .min(d3.min(allData, d => d.month))
    .max(d3.max(allData, d => d.month))
    .step(1)
    .width(width)
    .displayValue(true)
    .on('onchange', (val) => {
      targetMonth = val;
      updateVis();
    });
  
  d3.select('#slider')
    .append('svg')
    .attr('width', width)
    .attr('height', 70)
    .append('g')
    .attr('transform', 'translate(30,30)')
    .call(slider);

  var daySlider = d3.sliderHorizontal()
    .min(d3.min(allData, d => d.day))
    .max(d3.max(allData, d => d.day))
    .step(1)
    .width(width)
    .displayValue(true)
    .on('onchange', (val) => {
      targetDay = val;
      updateVis();
    });
  
  d3.select('#daySlider')
    .append('svg')
    .attr('width', width)
    .attr('height', 70)
    .append('g')
    .attr('transform', 'translate(30,30)')
    .call(daySlider);

  d3.selectAll('.variable')
    .each(function() {
      d3.select(this).selectAll('option')
        .data(options)
        .enter()
        .append('option')
        .text(d => d)
        .attr("value", d => d);
    })
    .on("change", function() {
      const selectedId = d3.select(this).property("id");
      const selectedValue = d3.select(this).property("value");

      if (selectedId === "xVariable") {
        xVar = selectedValue;
      } else if (selectedId === "yVariable") {
        yVar = selectedValue;
      } else if (selectedId === "sizeVariable") {
        sizeVar = selectedValue;
      }
      updateAxes();
      updateVis();
    });
  d3.select('#xVariable').property('value', xVar);
  d3.select('#yVariable').property('value', yVar);
  d3.select('#sizeVariable').property('value', sizeVar);

  const regionOptions = ["All Regions", "East Coast", "Midwest", "Central", "Pacific"];
  d3.select('#regionVariable')
    .selectAll('option')
    .data(regionOptions)
    .enter()
    .append('option')
    .text(d => d)
    .attr("value", d => d);
  
  d3.select('#regionVariable').on("change", function() {
    regionVar = d3.select(this).property("value");
    updateAxes();
    updateVis();
  });
  d3.select('#regionVariable').property('value', regionVar);
  
  d3.select('#toggleMode')
    .on('click', function() {
      brushingMode = !brushingMode;
      d3.select(this).text(brushingMode ? "Switch to Tooltip Only" : "Switch to Brush/Zoom Mode");
      updateBrushOverlay();
    });
  
  d3.select('#reset')
    .on('click', function() {
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
      if (gBrush) {
        brush.move(gBrush, null);
      }
      gPoints.selectAll(".points").classed("selected", false);
    });
}

function updateAxes() {
  let dataForScale = allData.filter(d => 
    d.month === targetMonth &&
    d.day === targetDay &&
    (regionVar === "All Regions" || d.region === regionVar)
  );
  if (dataForScale.length === 0) {
    dataForScale = allData; 
  }
  
  xScale = d3.scaleLinear()
    .domain([d3.min(dataForScale, d => d[xVar]), d3.max(dataForScale, d => d[xVar])])
    .range([0, width])
    .nice();
    
  yScale = d3.scaleLinear()
    .domain([d3.min(dataForScale, d => d[yVar]), d3.max(dataForScale, d => d[yVar])])
    .range([height, 0])
    .nice();
    
  sizeScale = d3.scaleSqrt()
    .domain([0, d3.max(dataForScale, d => d[sizeVar])])
    .range([2, 8]);
  
  gXAxis.transition().duration(t).call(d3.axisBottom(xScale).ticks(8));
  gYAxis.transition().duration(t).call(d3.axisLeft(yScale).ticks(8));
  
  mainGroup.selectAll('.labels').remove();
  mainGroup.append("text")
    .attr("class", "labels")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 20)
    .attr("text-anchor", "middle")
    .text(xVar)
    .text(xVar.toUpperCase());
    
  mainGroup.append("text")
    .attr("class", "labels")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 20)
    .attr("text-anchor", "middle")
    .text(yVar)
    .text(yVar.toUpperCase());
  
  currentXScale = xScale;
  currentYScale = yScale;
}
  
function updateVis() {
  let currentData = allData.filter(d => 
    d.month === targetMonth &&
    d.day === targetDay &&
    (regionVar === "All Regions" || d.region === regionVar)
  );

  const circles = gPoints.selectAll('.points')
    .data(currentData, d => d.date);

  circles.exit()
    .transition().duration(t)
    .attr('r', 0)
    .remove();

  circles.transition().duration(t)
    .attr('cx', d => xScale(d[xVar]))
    .attr('cy', d => yScale(d[yVar]))
    .attr('r', d => sizeScale(d[sizeVar]))
    .style('fill', d => colorScale(d.region));

  circles.enter()
    .append('circle')
    .attr('class', 'points')
    .attr('cx', d => xScale(d[xVar]))
    .attr('cy', d => yScale(d[yVar]))
    .attr('r', 0)
    .style('opacity', 0.7)
    .style('fill', d => colorScale(d.region))
    .on('mouseover', function(event, d) {
      d3.select(this)
        .style("fill", "black")
        .style("opacity", 1);
      d3.select('#tooltip')
        .style("display", 'block')
        .html(`<strong>Date: ${d.month}-${d.day}-${d.year}</strong><br/>Region: ${d.region}<br/>${xVar}: ${d[xVar]}<br/>${yVar}: ${d[yVar]}`)
        .style("left", (event.pageX + 20) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      d3.select(this)
        .style("opacity", 0.7)
        .style("fill", d => colorScale(d.region));
      d3.select('#tooltip')
        .style('display', 'none');
    })
    .transition().duration(t)
    .attr('r', d => sizeScale(d[sizeVar]));
}

function updateBrushOverlay() {
  if (brushingMode) {
    svg.call(zoom);
    if (!gBrush) {
      brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("brush", brushed)
        .on("end", brushended);
      gBrush = mainGroup.append("g")
        .attr("class", "brush")
        .call(brush);
    }
  } else {
    if (gBrush) {
      gBrush.remove();
      gBrush = null;
    }
    svg.on(".zoom", null);
  }
}
  
function zoomed(event) {
  const transform = event.transform;
  const newXScale = transform.rescaleX(xScale);
  const newYScale = transform.rescaleY(yScale);
  
  gXAxis.call(d3.axisBottom(newXScale).ticks(8));
  gYAxis.call(d3.axisLeft(newYScale).ticks(8));
  
  gPoints.selectAll('.points')
    .attr("cx", d => newXScale(d[xVar]))
    .attr("cy", d => newYScale(d[yVar]));
  
  currentXScale = newXScale;
  currentYScale = newYScale;
}

function brushed(event) {
  if (event.selection === null) {
    gPoints.selectAll(".points").classed("selected", false);
  } else {
    const [[x0, y0], [x1, y1]] = event.selection;
    gPoints.selectAll(".points").classed("selected", d => {
      const cx = currentXScale(d[xVar]);
      const cy = currentYScale(d[yVar]);
      return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    });
  }
}

function brushended(event) {
  if (!event.selection) {
    gPoints.selectAll(".points").classed("selected", false);
    return;
  }
  const [[x0, y0], [x1, y1]] = event.selection;
  const dx = x1 - x0, dy = y1 - y0;
  if (dx === 0 || dy === 0) return; 

  const scale = Math.min(width / dx, height / dy);
  const translateX = width / 2 - scale * ((x0 + x1) / 2);
  const translateY = height / 2 - scale * ((y0 + y1) / 2);
  const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

  svg.transition().duration(750).call(zoom.transform, transform);

  brush.move(gBrush, null);
}
