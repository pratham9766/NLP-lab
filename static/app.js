const form = document.querySelector("#scrapeForm");
const urlInput = document.querySelector("#urlInput");
const statusBox = document.querySelector("#status");
const emptyState = document.querySelector("#emptyState");
const results = document.querySelector("#results");
const menuItems = document.querySelectorAll(".menu-item");
const csvButton = document.querySelector("#csvButton");
let latestScrape = null;

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
    const safeRows = Array.isArray(rows) ? rows : [];
    container.innerHTML = "";

    if (!safeRows.length) {
        container.appendChild(createListItem(emptyText));
        return;
    }

    safeRows.forEach((row) => container.appendChild(renderer(row)));
}

function renderResults(data) {
    const counts = data.counts || {};
    const headings = Array.isArray(data.headings) ? data.headings : [];
    const links = Array.isArray(data.links) ? data.links : [];
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];

    document.querySelector("#headingCount").textContent = counts.headings || headings.length;
    document.querySelector("#linkCount").textContent = counts.links || links.length;
    document.querySelector("#imageCount").textContent = counts.images || images.length;
    document.querySelector("#videoCount").textContent = counts.videos || videos.length;
    document.querySelector("#wordCount").textContent = counts.words || 0;

    document.querySelector("#pageTitle").textContent = data.title;
    const pageUrl = document.querySelector("#pageUrl");
    pageUrl.textContent = data.url;
    pageUrl.href = data.url;
    document.querySelector("#pageDescription").textContent = data.description || "No meta description found.";
    document.querySelector("#textPreview").textContent = data.textPreview || "No readable page text found.";

    renderList("#headingsList", headings, "No headings found.", (heading) => (
        createListItem(`<strong>${heading.level}</strong> ${escapeHtml(heading.text)}`)
    ));

    renderList("#linksList", links, "No links found.", (link) => (
        createListItem(`<a href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.text)}</a>`)
    ));

    const imagesList = document.querySelector("#imagesList");
    imagesList.innerHTML = "";
    if (!images.length) {
        imagesList.appendChild(createListItem("No images found."));
    } else {
        images.forEach((image) => {
            const card = document.createElement("article");
            card.className = "image-card";
            card.innerHTML = `
                <img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.alt)}" loading="lazy">
                <a href="${escapeAttribute(image.url)}" target="_blank" rel="noreferrer">${escapeHtml(image.alt)}</a>
            `;
            imagesList.appendChild(card);
        });
    }

    renderList("#videosList", videos, "No videos or video embeds found.", (video) => (
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

function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
}

function createCsvRows(data) {
    const rows = [["category", "label", "value", "url"]];
    const headings = Array.isArray(data.headings) ? data.headings : [];
    const links = Array.isArray(data.links) ? data.links : [];
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];

    rows.push(["summary", "source_url", data.url || "", data.url || ""]);
    rows.push(["summary", "title", data.title || "", ""]);
    rows.push(["summary", "description", data.description || "", ""]);
    rows.push(["summary", "text_preview", data.textPreview || "", ""]);

    headings.forEach((heading) => {
        rows.push(["heading", heading.level || "", heading.text || "", ""]);
    });

    links.forEach((link) => {
        rows.push(["link", link.text || "", "", link.url || ""]);
    });

    images.forEach((image) => {
        rows.push(["image", image.alt || "Image", "", image.url || ""]);
    });

    videos.forEach((video) => {
        rows.push(["video", video.label || "Video", video.type || "", video.url || ""]);
    });

    return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function downloadCsv() {
    if (!latestScrape) {
        setStatus("Scrape a page before downloading CSV.", true);
        return;
    }

    const csv = createCsvRows(latestScrape);
    const blob = new Blob([csv], {type: "text/csv;charset=utf-8"});
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
    link.href = URL.createObjectURL(blob);
    link.download = `scrape-results-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

menuItems.forEach((item) => {
    item.addEventListener("click", () => setActiveTab(item.dataset.tab));
});

csvButton.addEventListener("click", downloadCsv);

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Scraping page...");
    csvButton.disabled = true;

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

        latestScrape = data;
        renderResults(data);
        setActiveTab("summary");
        csvButton.disabled = false;
        setStatus(data.error || "", Boolean(data.error));
    } catch (error) {
        setStatus(error.message, true);
    }
});
