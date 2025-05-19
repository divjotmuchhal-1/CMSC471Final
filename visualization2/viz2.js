const csvPath = "data2/weather.csv";
const UNITS = {
  TMIN: "°F",
  TMAX: "°F",
  TAVG: "°F",
  PRCP: "in",
  SNOW: "in",
  SNWD: "in",
  AWND: "mph",
  WSF5: "mph",
  WDF5: "°",
  elevation: "ft",
  latitude: "°",
  longitude: "°"
};

const svg = d3.select("svg"),
  tooltip = d3.select("#tooltip-viz"),
  controls = d3.select("#controls-viz");

const { width: svgW, height: svgH } = svg.node().getBoundingClientRect();
const margin = { top: 40, left: 60, right: 110, bottom: 70 },
  width = svgW - margin.left - margin.right,
  height = svgH - margin.top - margin.bottom;

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const xScale = d3.scaleLinear().range([0, width]),
  yScale = d3.scaleLinear().range([height, 0]);

const xAxisG = g
  .append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0,${height})`);
const yAxisG = g.append("g").attr("class", "axis");

const title = g
  .append("text")
  .attr("x", width / 2)
  .attr("y", -15)
  .attr("text-anchor", "middle")
  .attr("font-weight", "bold");
const xLabel = g
  .append("text")
  .attr("x", width / 2)
  .attr("y", height + 30)
  .attr("text-anchor", "middle");
const yLabel = g
  .append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", -50)
  .attr("text-anchor", "middle");

const dotsG = g.append("g");
const legendG = g
  .append("g")
  .attr("class", "legend")
  .attr("transform", `translate(${width + 40},0)`);

const parseYMD = d3.timeParse("%Y%m%d"),
  fmtMMDDYY = d3.timeFormat("%m/%d/%Y");

// Load CSV and bootstrap the app

d3.csv(csvPath, d3.autoType).then((data) => {
  const latestInt = d3.max(data, (d) => d.date);
  const latestStr = fmtMMDDYY(parseYMD(String(latestInt)));
  window.weatherData = data.filter((d) => d.date === latestInt);

  const numericKeys = Object.keys(window.weatherData[0]).filter(
    (k) =>
      k !== "date" &&
      k !== "station" &&
      k !== "state" &&
      Number.isFinite(window.weatherData[0][k])
  );

  const comparisons = [];
  for (let i = 0; i < numericKeys.length - 1; i++)
    for (let j = i + 1; j < numericKeys.length; j++)
      comparisons.push({
        id: `${numericKeys[i]}_${numericKeys[j]}`,
        x: numericKeys[i],
        y: numericKeys[j],
        label: `${numericKeys[i]} vs ${numericKeys[j]}`
      });

  controls
    .selectAll("button")
    .data(comparisons)
    .enter()
    .append("button")
    .attr("id", (d) => d.id)
    .text((d) => d.label)
    .on("click", (_, d) => updateComparison(d));

  updateComparison(comparisons[0]);

  function updateComparison(comp) {
    controls.selectAll("button").classed("active", (d) => d.id === comp.id);

    const rows = window.weatherData.filter(
      (d) => Number.isFinite(d[comp.x]) && Number.isFinite(d[comp.y])
    );

    xScale.domain(d3.extent(rows, (d) => d[comp.x])).nice();
    yScale.domain(d3.extent(rows, (d) => d[comp.y])).nice();

    xAxisG.transition().duration(600).call(d3.axisBottom(xScale));
    yAxisG.transition().duration(600).call(d3.axisLeft(yScale));

    const xUnit = UNITS[comp.x] || "",
      yUnit = UNITS[comp.y] || "";
    xLabel.text(`${comp.x}${xUnit ? " (" + xUnit + ")" : ""}`);
    yLabel.text(`${comp.y}${yUnit ? " (" + yUnit + ")" : ""}`);
    title.text(`${comp.label.toUpperCase()}`);

    const color = d3
      .scaleSequential()
      .domain(yScale.domain())
      .interpolator(d3.interpolateViridis);
    drawLegend(color, yScale.domain(), yUnit, comp.y);

    const circles = dotsG.selectAll("circle").data(rows, (d) => d.station);

    circles.exit().transition().duration(400).attr("r", 0).remove();

    circles
      .transition()
      .duration(600)
      .attr("cx", (d) => xScale(d[comp.x]))
      .attr("cy", (d) => yScale(d[comp.y]))
      .attr("fill", (d) => color(d[comp.y]));

    circles
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d[comp.x]))
      .attr("cy", (d) => yScale(d[comp.y]))
      .attr("r", 0)
      .attr("fill", (d) => color(d[comp.y]))
      .transition()
      .duration(600)
      .attr("r", 4);

    dotsG
      .selectAll("circle")
      .on("mouseenter", (event, d) => {
        tooltip.style("visibility", "visible").html(
          `<strong>${d.station}</strong><br>
           ${comp.x}: ${d[comp.x]}${xUnit ? " " + xUnit : ""}<br>
           ${comp.y}: ${d[comp.y]}${yUnit ? " " + yUnit : ""}<br>
           State: ${d.state}`
        );
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", event.pageY + 12 + "px")
          .style("left", event.pageX + 12 + "px");
      })
      .on("mouseleave", () => tooltip.style("visibility", "hidden"));
  }


  function drawLegend(colorScale, domain, unit, label) {
    legendG.selectAll("*").remove();

    const barW = 12,
      barH = 150;

    const defs = legendG.append("defs");
    const grad = defs
      .append("linearGradient")
      .attr("id", "legend-grad")
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");

    const stops = 10;
    d3.range(stops + 1).forEach((i) => {
      const t = i / stops;
      grad
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", colorScale(domain[0] + t * (domain[1] - domain[0])));
    });

    legendG
      .append("rect")
      .attr("width", barW)
      .attr("height", barH)
      .style("fill", "url(#legend-grad)");

    const scale = d3.scaleLinear().domain(domain).range([barH, 0]);
    legendG
      .append("g")
      .attr("transform", `translate(${barW},0)`)
      .call(d3.axisRight(scale).ticks(5))
      .call((g) => g.selectAll("text").attr("font-size", "0.7rem"));

    legendG
      .append("text")
      .attr("x", 0)
      .attr("y", -6)
      .attr("font-size", "0.75rem")
      .text(`${label}${unit ? " (" + unit + ")" : ""}`);
  }
});
