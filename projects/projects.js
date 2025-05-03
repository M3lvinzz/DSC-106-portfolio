import { fetchJSON, renderProjects } from "../global.js";
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

let colors = d3.scaleOrdinal(d3.schemeTableau10);

let selectedYear = -1;
let selectedIndex = -1;
let query = '';

function getFilteredProjects(projects, selectedYear, query) {
    return projects.filter((project) => {
        const matchesYear = selectedYear === -1 || project.year === selectedYear;
        const projectValues = Object.values(project).join('\n').toLowerCase();
        const matchesQuery = query === '' || projectValues.includes(query.toLowerCase());
        return matchesYear && matchesQuery;
    });
}

function renderPieChart(projectsGiven) {
    let newRolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year,
    );
    let newData = newRolledData.map(([year, count]) => ({
        value: count,
        label: year
    }));
    newData.sort((a, b) => b.label - a.label);

    let newSliceGenerator = d3.pie().value((d) => d.value);
    let newArcData = newSliceGenerator(newData);
    let newArcs = newArcData.map((d) => arcGenerator(d));

    let legend = d3.select('.legend');
    legend.selectAll('li').remove();

    newData.forEach((d, idx) => {
        legend
            .append('li')
            .attr('style', `--color:${colors(idx)}`)
            .attr('class', 'legend-item')
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
    });

    let svg = d3.select('svg');
    svg.selectAll('path').remove();
    newArcs.forEach((arc, i) => {
        let path = svg
            .append('path')
            .attr('d', arc)
            .attr('fill', colors(i))
            .on('click', () => {
                selectedIndex = selectedIndex === i ? -1 : i;
                svg
                    .selectAll('path')
                    .attr('class', (_, idx) => (
                        idx === selectedIndex ? 'selected' : ''
                    ));
                legend
                    .selectAll('li')
                    .attr('class', (_, idx) => (
                        `legend-item${idx === selectedIndex ? ' selected' : ''}`
                    ));

                if (selectedIndex === -1) {
                    plotVisuals(projects);
                } else {
                    selectedYear = newData[selectedIndex].label;
                    let filteredProjects = getFilteredProjects(projects, selectedYear, query);
                    renderProjects(filteredProjects, projectsContainer, 'h2');
                }
            });
        if (selectedIndex === i) {
            path.attr('class', 'selected');
        }
    });
}

function plotVisuals(projectsToRender) {
    renderProjects(projectsToRender, projectsContainer, 'h2');
    renderPieChart(projectsToRender);
}

let searchInput = document.querySelector('.searchBar');
searchInput.addEventListener('input', (event) => {
    query = event.target.value;
    selectedYear = -1;
    let filteredProjects = getFilteredProjects(projects, selectedYear, query);
    plotVisuals(filteredProjects);
});

plotVisuals(projects);