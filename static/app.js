const form = document.querySelector("#scrapeForm");
const urlInput = document.querySelector("#urlInput");
const statusBox = document.querySelector("#status");
const emptyState = document.querySelector("#emptyState");
const results = document.querySelector("#results");
const menuItems = document.querySelectorAll(".menu-item");

const panels = {
    summary: document.querySelector("#summaryPanel"),
    headings: document.querySelector("#headingsPanel"),
    links: document.querySelector("#linksPanel"),
    images: document.querySelector("#imagesPanel"),
    videos: document.querySelector("#videosPanel"),
};

function setStatus(message, isError = false) {
    statusBox.textContent = message;
    statusBox.classList.toggle("hidden", !message);
    statusBox.classList.toggle("error", isError);
}

function setActiveTab(tab) {
    menuItems.forEach((item) => item.classList.toggle("active", item.dataset.tab === tab));
    Object.entries(panels).forEach(([key, panel]) => {
        panel.classList.toggle("active", key === tab);
    });
}

function createListItem(html) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = html;
    return item;
}

function renderList(containerId, rows, emptyText, renderer) {
    const container = document.querySelector(containerId);
    container.innerHTML = "";

    if (!rows.length) {
        container.appendChild(createListItem(emptyText));
        return;
    }

    rows.forEach((row) => container.appendChild(renderer(row)));
}

function renderResults(data) {
    document.querySelector("#headingCount").textContent = data.counts.headings;
    document.querySelector("#linkCount").textContent = data.counts.links;
    document.querySelector("#imageCount").textContent = data.counts.images;
    document.querySelector("#videoCount").textContent = data.counts.videos;
    document.querySelector("#wordCount").textContent = data.counts.words;

    document.querySelector("#pageTitle").textContent = data.title;
    const pageUrl = document.querySelector("#pageUrl");
    pageUrl.textContent = data.url;
    pageUrl.href = data.url;
    document.querySelector("#pageDescription").textContent = data.description || "No meta description found.";
    document.querySelector("#textPreview").textContent = data.textPreview || "No readable page text found.";

    renderList("#headingsList", data.headings, "No headings found.", (heading) => (
        createListItem(`<strong>${heading.level}</strong> ${escapeHtml(heading.text)}`)
    ));

    renderList("#linksList", data.links, "No links found.", (link) => (
        createListItem(`<a href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.text)}</a>`)
    ));

    const imagesList = document.querySelector("#imagesList");
    imagesList.innerHTML = "";
    if (!data.images.length) {
        imagesList.appendChild(createListItem("No images found."));
    } else {
        data.images.forEach((image) => {
            const card = document.createElement("article");
            card.className = "image-card";
            card.innerHTML = `
                <img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.alt)}" loading="lazy">
                <a href="${escapeAttribute(image.url)}" target="_blank" rel="noreferrer">${escapeHtml(image.alt)}</a>
            `;
            imagesList.appendChild(card);
        });
    }

    renderList("#videosList", data.videos, "No videos or video embeds found.", (video) => (
        createListItem(`
            <strong>${escapeHtml(video.type)}</strong>
            <a href="${escapeAttribute(video.url)}" target="_blank" rel="noreferrer">${escapeHtml(video.label)}</a>
            <small>${escapeHtml(video.url)}</small>
        `)
    ));

    emptyState.classList.add("hidden");
    results.classList.remove("hidden");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
}

menuItems.forEach((item) => {
    item.addEventListener("click", () => setActiveTab(item.dataset.tab));
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Scraping page...");

    try {
        const response = await fetch("/api/scrape", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({url: urlInput.value}),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Scraping failed.");
        }

        renderResults(data);
        setActiveTab("summary");
        setStatus("");
    } catch (error) {
        setStatus(error.message, true);
    }
});
