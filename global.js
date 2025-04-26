console.log('Hello World');

function $$(selector, context = document) {
    return Array.from(context.querySelector(selector));
}

const BASE_PATH = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '/' :'/DSC-106-portfolio/';

let pages = [
    {url: '', title: 'Home'},
    {url: 'projects/', title: 'Projects'},
    {url: 'resume/', title: 'Resume'},
    {url: 'contact/', title: 'Contact'},
    {url: 'https://github.com/M3lvinzz', title: 'Github'},
];

let nav = document.createElement('nav');
document.body.prepend(nav);
for (let p of pages) {
    let url = p.url;
    url = !url.startsWith('http') ? BASE_PATH + url : url;
    let title = p.title;
    // nav.insertAdjacentHTML('beforeend', `<a href="${url}">${title}</a>`);
    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;
    if (a.host === location.host && a.pathname === location.pathname) {
        a.classList.add('current');
    }
    if (a.host !== location.host) {
        a.target = "_blank";
      }
    nav.append(a);
}

const navLinks = $$('nav a');

let currentLink = navLinks.find(
    (a) => a.host === location.host && a.pathname === location.pathname,
  );
// if (currentLink) {
//     // or if (currentLink !== undefined)
//     currentLink.classList.add('current');
//   }

currentLink?.classList.add('current');

console.log(navLinks)

document.body.insertAdjacentHTML(
    'afterbegin',
    `
        <label class = 'color-scheme'>
            Theme:
            <select>
                <option value = 'light dark'>Automatic</option>
                <option value = 'dark'>Dark</option>
                <option value = 'light'>Light</option>
            </select>
        </label>
    `
);

let select = document.querySelector('select')
select.addEventListener('input', function (event) {
    console.log('color scheme changed to', event.target.value);
    document.documentElement.style.setProperty('color-scheme', event.target.value);
    localStorage.colorScheme = event.target.value;
});

if ('colorScheme' in localStorage) {
    let savedTheme = localStorage.colorScheme;
    document.documentElement.style.setProperty('color-scheme', savedTheme);
    select.value = savedTheme;
}

const form = document.querySelector('form');

form?.addEventListener('submit', function (event) {
  event.preventDefault();
  const data = new FormData(form);
  let params = [];
  for (let [name, value] of data) {
    params.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  const url = `mailto:${form.action}?${params.join('&')}`;
  location.href = url;
});

export async function fetchJSON(url) {
    try {
      // Fetch the JSON file from the given URL
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching or parsing JSON data:', error);
    }
  }

  export function renderProjects(projects, containerElement, headingLevel = 'h2') {
    containerElement.innerHTML = '';
  
    for (let i = 0; i < projects.length; i++) {
      const article = document.createElement('article');
  
      const img = document.createElement('img');
      img.src = projects[i].image;
      img.alt = projects[i].title;
  
      const heading = document.createElement(headingLevel);
      heading.textContent = projects[i].title;
  
      const description = document.createElement('p');
      description.textContent = projects[i].description;
  
      article.appendChild(heading);
      article.appendChild(img);
      article.appendChild(description);
  
      containerElement.appendChild(article);
    }
  }
  
  export async function fetchGitHubData(username) {
    return fetchJSON(`https://api.github.com/users/${username}`);
  }