import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

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
    .call(xAxis);

  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  svg.call(d3.brush().on("start brush end", brushed));

  const dots = svg.append("g").attr("class", "dots");

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll("circle")
    .data(sortedCommits)
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

let data = await loadData();
let commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
