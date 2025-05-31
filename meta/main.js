import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

async function loadData() {
  const data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: Number(row.line), // or just +row.line
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime),
  }));
  console.log(data);
  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: "https://github.com/vis-society/lab-7/commit/" + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, "lines", {
        value: lines,
        enumerable: false,
        writable: true,
        configurable: true,
      });

      return ret;
    });
}

function renderCommitInfo(data, commits) {
  data = data || [];
  commits = commits || [];

  const statsContainer = d3.select("#stats");
  statsContainer.html("");

  const dl = statsContainer.append("dl").attr("class", "stats");

  dl.append("dt").html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append("dd").text(data.length);

  dl.append("dt").text("Total commits");
  dl.append("dd").text(commits.length);

  let averageLineLengthText = "0";
  if (data.length > 0) {
    const meanVal = d3.mean(data, (d) => d.length);
    if (meanVal !== undefined) {
      averageLineLengthText = meanVal.toFixed(2);
    }
  }
  dl.append("dt").text("Average line length");
  dl.append("dd").text(`${averageLineLengthText} characters`);

  let longestLineLengthText = "0";
  if (data.length > 0) {
    const maxVal = d3.max(data, (d) => d.length);
    if (maxVal !== undefined) {
      longestLineLengthText = maxVal.toString();
    }
  }
  dl.append("dt").text("Longest line length");
  dl.append("dd").text(`${longestLineLengthText} characters`);

  let busiestDay = "N/A";
  if (commits.length > 0) {
    const validCommits = commits.filter(
      (commit) =>
        commit && commit.date && !isNaN(new Date(commit.date).getTime())
    );

    if (validCommits.length > 0) {
      const workByDay = d3.rollups(
        validCommits,
        (v) => v.length,
        (d) => new Date(d.date).getDay()
      );

      const busiestDayEntry = d3.greatest(workByDay, (d) => d[1]);

      if (busiestDayEntry) {
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        busiestDay = dayNames[busiestDayEntry[0]];
      } else {
        busiestDay = "N/A (calculation error)";
      }
    } else {
      busiestDay = "N/A (no valid commit dates)";
    }
  }
  dl.append("dt").text("Busiest commit day");
  dl.append("dd").text(busiestDay);
}

let xScale;
let yScale;

function renderScatterPlot(data, commits) {
  const chartContainer = d3.select("#chart");
  if (chartContainer.empty()) {
    return;
  }
  chartContainer.select("svg").remove();

  if (!commits || commits.length === 0) {
    return;
  }

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const timeExtent = d3.extent(commits, (d) => d.datetime);

  if (
    typeof minLines === "undefined" ||
    typeof maxLines === "undefined" ||
    typeof timeExtent[0] === "undefined" ||
    typeof timeExtent[1] === "undefined"
  ) {
    return;
  }

  const width = 1000;
  const height = 600;

  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const svg = chartContainer
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  xScale = d3.scaleTime().domain(timeExtent).range([0, width]).nice();
  yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);

  const margin = { top: 10, right: 10, bottom: 30, left: 20 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  xScale.range([usableArea.left, usableArea.right]);
  yScale.range([usableArea.bottom, usableArea.top]);

  const gridlines = svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`);

  gridlines.call(
    d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width)
  );

  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

  svg
    .append("g")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .attr("class", "x-axis")
    .call(xAxis);

  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .attr("class", "y-axis")
    .call(yAxis);

  svg.call(d3.brush().on("start brush end", brushed));

  const dots = svg.append("g").attr("class", "dots");

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    // .style("fill", "steelblue") // Removed this line to allow CSS to control fill
    .style("stroke", "black")
    .style("stroke-width", 1)
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false);
    });
}

function renderTooltipContent(commit) {
  const link = document.getElementById("commit-link");
  const date = document.getElementById("commit-date");

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString("en", {
    dateStyle: "full",
  });
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}
function createBrushSelector(svg) {
  svg.call(d3.brush());
  svg.selectAll(".dots, .overlay ~ *").raise();
}

function renderSelectionCount(selection) {
  // The .classed("selected", ...) logic is already handled in the brushed function.
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector("#selection-count");
  countElement.textContent = `${
    selectedCommits.length || "No"
  } commits selected`;

  return selectedCommits;
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll("circle").classed("selected", (d) =>
    isCommitSelected(selection, d)
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const commitX = xScale(commit.datetime);
  const commitY = yScale(commit.hourFrac);

  return (
    commitX >= Math.min(x0, x1) &&
    commitX <= Math.max(x0, x1) &&
    commitY >= Math.min(y0, y1) &&
    commitY <= Math.max(y0, y1)
  );
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById("language-breakdown");

  if (selectedCommits.length === 0) {
    container.innerHTML = "";
    return;
  }
  const requiredCommits = selectedCommits.length ? selectedCommits : commits;
  const lines = requiredCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type
  );

  // Update DOM with breakdown
  container.innerHTML = "";

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format(".1~%")(proportion);

    container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
  }
}

function updateScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select("#chart").select("svg");

  xScale = xScale.domain(d3.extent(commits, (d) => d.datetime));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const xAxis = d3.axisBottom(xScale);

  // CHANGE: we should clear out the existing xAxis and then create a new one.
  const xAxisGroup = svg.select("g.x-axis");
  xAxisGroup.selectAll("*").remove();
  xAxisGroup.call(xAxis);

  const dots = svg.select("g.dots");

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  dots
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .style("fill-opacity", 0.7) // Add transparency for overlapping dots
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1); // Full opacity on hover
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false);
    });
}

let data = await loadData();
let commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

let commitProgress = 100;
let timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);
let commitMaxTime = timeScale.invert(commitProgress);
let filteredCommits = commits;
const sliderElement = document.getElementById("commit-progress");
const timeDisplayElement = document.getElementById("commit-time");
let colors = d3.scaleOrdinal(d3.schemeTableau10);

function onTimeSliderChange(event) {
  let newSliderValue;

  if (event && event.target) {
    newSliderValue = event.target.value;
  } else {
    newSliderValue = sliderElement ? sliderElement.value : commitProgress;
  }

  commitProgress = Number(newSliderValue);
  commitMaxTime = timeScale.invert(commitProgress);

  if (timeDisplayElement) {
    timeDisplayElement.textContent = commitMaxTime.toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    });
    timeDisplayElement.setAttribute("datetime", commitMaxTime.toISOString());
  }

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);
}

function updateFileDisplay(list) {
  const lines = list.flatMap((d) => d.lines);
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  const rows = d3
    .select("#files")
    .selectAll("div")
    .data(files, (d) => d.name)
    .join((enter) =>
      enter.append("div").call((div) => {
        div.append("dt");
        div.append("dd");
      })
    );

  rows.select("dt").text((d) => d.name);

  rows
    .select("dd")
    .html((d) => `${d.lines.length} lines`) // Sets text content, new .loc divs will be appended after this
    .selectAll(".loc")
    .data((d) => d.lines) // d here is the file object
    .join("div")
    .attr("class", "loc")
    .style("--clr", (l, i, arr) => d3.schemeTableau10[i % 10]) // Sets --clr custom property
    // MODIFIED LINE: Use .style() to set the --color custom property
    .style("--color", (d_line) => colors(d_line.type)); // d_line is a line object
}

if (sliderElement) {
  sliderElement.addEventListener("input", onTimeSliderChange);
}

onTimeSliderChange();
updateFileDisplay(filteredCommits);

d3.select("#scatter-story")
  .selectAll(".step")
  .data(commits)
  .join("div")
  .attr("class", "step")
  .html(
    (d, i) => `
		On ${d.datetime.toLocaleString("en", {
      dateStyle: "full",
      timeStyle: "short",
    })},
		I made <a href="${d.url}" target="_blank">${
      i > 0 ? "another glorious commit" : "my first commit, and it was glorious"
    }</a>.
		I edited ${d.totalLines} lines across ${
      d3.rollups(
        d.lines,
        (D) => D.length,
        (d) => d.file
      ).length
    } files.
		Then I looked over all I had made, and I saw that it was very good.
	`
  );

function onStepEnter(response) {
  console.log(response.element.__data__.datetime);
}
const scroller = scrollama();
scroller
  .setup({
    container: "#scrolly-1",
    step: "#scrolly-1 .step",
  })
  .onStepEnter(onStepEnter);
