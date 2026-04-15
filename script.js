/**
 * Image Slider – FHNW Campus Muttenz (Infinite Loop Edition)
 */

// ============================================================
// Konstanten
// ============================================================
const ITEM_COUNT = 11; // Anzahl originaler Bilder
const SCROLL_DURATION = 400; // ms – Dauer des Auto-Scrolls
const FIXED_LAYER_DELAY = 550; // ms – Warten nach Slide-Transition
const LABEL_DELAY = 400; // ms – Warten vor Label-Update
const SCROLL_TOLERANCE = 100; // px – Toleranz für "Seite ganz unten"

// ============================================================
// DOM-Referenzen
// ============================================================
const wrapper = document.getElementById("wrapper");
const track = document.getElementById("track");
const beschriebEl = document.querySelector(".beschrieb p");
const counterEl = document.querySelector(".image-counter p");
const projectIconEl = document.getElementById("project-icon");

// ============================================================
// Fixed-Layer erstellen (Styling liegt in style.css)
// ============================================================
const fixedLayer = document.createElement("div");
fixedLayer.id = "fixed-layer";
document.body.appendChild(fixedLayer);

// ============================================================
// Hilfsfunktionen
// ============================================================

function getCurrentTranslateX() {
  const transform = window.getComputedStyle(track).transform;
  if (transform === "none") return 0;
  const matrix = transform.match(/^matrix\((.+)\)$/);
  return matrix ? parseFloat(matrix[1].split(", ")[4]) : 0;
}

function isPageAtBottom() {
  const scrollPosition = window.scrollY + window.innerHeight;
  const pageHeight = document.documentElement.scrollHeight;
  return scrollPosition >= pageHeight - SCROLL_TOLERANCE;
}

function scrollToBottomThen(callback) {
  if (isPageAtBottom()) {
    callback();
    return;
  }

  const startY = window.scrollY;
  const endY = document.documentElement.scrollHeight - window.innerHeight;
  const startTime = performance.now();

  function step(currentTime) {
    const progress = Math.min((currentTime - startTime) / SCROLL_DURATION, 1);
    window.scrollTo(0, startY + (endY - startY) * progress);
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
  setTimeout(callback, SCROLL_DURATION);
}

function toOriginalIndex(globalIndex) {
  return parseInt(globalIndex) % ITEM_COUNT;
}

// ============================================================
// Fixed-Layer aktualisieren
// ============================================================

function updateFixedImages(centeredIndex) {
  fixedLayer.innerHTML = "";

  const allItems = document.querySelectorAll(".img-item");
  const centeredEl = document.querySelector(
    `.img-item[data-index="${centeredIndex}"]`,
  );

  allItems.forEach((item) => (item.style.visibility = "visible"));

  if (!centeredEl) return;

  const centeredRect = centeredEl.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();

  allItems.forEach((item) => {
    if (parseInt(item.dataset.index) === parseInt(centeredIndex)) return;

    const rect = item.getBoundingClientRect();

    // Nur sichtbare Items klonen
    if (rect.right < 0 || rect.left > window.innerWidth) return;

    const offsetFromCenter = rect.left - centeredRect.left;
    const fixedTop = wrapperRect.top + wrapperRect.height / 2 - rect.height / 2;

    const clone = item.cloneNode(true);
    clone.style.cssText = `
            position: fixed;
            top: ${fixedTop}px;
            left: ${centeredRect.left + offsetFromCenter}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            pointer-events: auto;
            margin: 0;
            flex-basis: unset;
            cursor: pointer;
        `;
    clone.addEventListener("click", () => handleImageClick(item.dataset.index));
    fixedLayer.appendChild(clone);

    item.style.visibility = "hidden";
  });
}

// ============================================================
// Bild wechseln (mit Infinite-Loop Logik)
// ============================================================

function centerImage(globalIndex, isInitialLoad = false) {
  const allItems = document.querySelectorAll(".img-item");
  globalIndex = parseInt(globalIndex);

  // Zustand zurücksetzen
  fixedLayer.innerHTML = "";
  allItems.forEach((item) => {
    item.style.visibility = "visible";
    item.classList.remove("center");
  });

  const origIndex = toOriginalIndex(globalIndex);
  const originalItem = document.querySelector(
    `.img-item[data-index="${origIndex}"]`,
  );

  if (originalItem) {
    setTimeout(
      () => {
        if (beschriebEl)
          beschriebEl.textContent = originalItem.dataset.beschrieb;
        if (projectIconEl && originalItem.dataset.icon)
          projectIconEl.src = originalItem.dataset.icon;
        if (counterEl)
          counterEl.textContent = `${originalItem.dataset.nummer}/${ITEM_COUNT}`;
      },
      isInitialLoad ? 0 : LABEL_DELAY,
    );
  }

  setTimeout(() => {
    const target = document.querySelector(
      `.img-item[data-index="${globalIndex}"]`,
    );
    if (!target) return;

    target.classList.add("center");

    // Wenn initial geladen wird, springen wir ohne Animation, ansonsten stellen wir CSS wieder her
    if (isInitialLoad) {
      track.style.transition = "none";
    } else {
      track.style.transition = ""; // Setzt inline-style zurück, CSS-Transition greift wieder
    }

    const targetRect = target.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const offset =
      targetRect.left +
      targetRect.width / 2 -
      (wrapperRect.left + wrapperRect.width / 2);
    const newTranslate = getCurrentTranslateX() - offset;

    track.style.transform = `translateX(${newTranslate}px)`;

    // Nach der Animation: Infinite Teleport prüfen
    setTimeout(
      () => {
        let actualIndex = globalIndex;

        // Wenn wir in das erste Set (0-10) oder dritte Set (22-32) gerutscht sind,
        // springen wir unsichtbar zurück ins zweite Set (11-21)
        if (actualIndex < ITEM_COUNT || actualIndex >= 2 * ITEM_COUNT) {
          actualIndex = (actualIndex % ITEM_COUNT) + ITEM_COUNT;

          const jumpTarget = document.querySelector(
            `.img-item[data-index="${actualIndex}"]`,
          );
          if (jumpTarget) {
            // 1. Transition ausschalten für den unsichtbaren Sprung
            track.style.transition = "none";

            // 2. Position anpassen
            const jumpRect = jumpTarget.getBoundingClientRect();
            const jumpOffset =
              jumpRect.left +
              jumpRect.width / 2 -
              (wrapperRect.left + wrapperRect.width / 2);
            const jumpTranslate = getCurrentTranslateX() - jumpOffset;

            track.style.transform = `translateX(${jumpTranslate}px)`;

            // 3. Status austauschen
            target.classList.remove("center");
            jumpTarget.classList.add("center");

            // 4. Reflow erzwingen (WICHTIG! Das zwingt den Browser, den Sprung sofort zu machen)
            track.offsetHeight;
          }
        }

        // Layer nach möglichem Sprung updaten
        updateFixedImages(actualIndex);
      },
      isInitialLoad ? 0 : FIXED_LAYER_DELAY,
    );
  }, 50);
}

function handleImageClick(index) {
  const target = document.querySelector(`.img-item[data-index="${index}"]`);
  if (target && target.classList.contains("center")) return; // Klick auf das mittlere Bild ignorieren
  scrollToBottomThen(() => centerImage(index));
}

// ============================================================
// Initialisierung
// ============================================================

function appendClonedSet(startIndex) {
  const originals = document.querySelectorAll(".img-item:not(.cloned)");
  let idx = startIndex;
  originals.forEach((item) => {
    const clone = item.cloneNode(true);
    clone.dataset.index = idx;
    clone.classList.add("cloned");
    clone.addEventListener("click", () => handleImageClick(idx));
    track.appendChild(clone);
    idx++;
  });
  return idx;
}

// Originale initialisieren
let globalIndex = 0;
document.querySelectorAll(".img-item").forEach((item) => {
  item.dataset.index = globalIndex;
  item.addEventListener("click", () => handleImageClick(item.dataset.index));
  globalIndex++;
});

// Wir hängen ZWEI geklonte Sets an, so dass wir insgesamt 33 Elemente haben (0 bis 32)
globalIndex = appendClonedSet(globalIndex);
appendClonedSet(globalIndex);

// WIR STARTEN IM MITTLEREN SET (Index 11 = Bild 1)
const startIndex = ITEM_COUNT; // entspricht 11

// Nur auf Desktop ausführen
const isMobile = () => window.innerWidth <= 768;

if (!isMobile()) {
    // Initialer Aufruf (ohne Wisch-Animation beim ersten Laden der Seite)
    centerImage(startIndex, true);
    window.scrollTo(0, document.documentElement.scrollHeight);
}

// Language switcher logic
const langSwitcher = document.getElementById("lang-switcher");
if (langSwitcher) {
    const langs = ["(DE)", "(FR)", "(EN)"];
    let currentLangIndex = 0;
    langSwitcher.addEventListener("click", () => {
        currentLangIndex = (currentLangIndex + 1) % langs.length;
        langSwitcher.textContent = langs[currentLangIndex];
    });
}


// ============================================================
// Disclaimer Overlay Logic
// ============================================================
const disclaimerOverlay = document.getElementById("disclaimer-overlay");
if (disclaimerOverlay) {
    // Falls du willst, dass es pro Browser-Sitzung nur EINMAL auftaucht,
    // kannst du diese Auskommentierung entfernen:
    
    // if (sessionStorage.getItem('disclaimerSeen')) {
    //     disclaimerOverlay.style.display = 'none';
    // }

    disclaimerOverlay.addEventListener("click", () => {
        disclaimerOverlay.style.opacity = '0';
        setTimeout(() => {
            disclaimerOverlay.style.visibility = 'hidden';
            disclaimerOverlay.style.display = 'none';
            // sessionStorage.setItem('disclaimerSeen', 'true');
        }, 500);
    });
}


// ============================================================
// About Overlay Logic
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
const aboutLink = document.getElementById("about-link");
const aboutOverlay = document.getElementById("about-overlay");

if (aboutLink && aboutOverlay) {
    aboutLink.addEventListener("click", (e) => {
        e.preventDefault(); // Verhindert das Neuladen der Seite
        aboutOverlay.style.display = 'flex';
        // Kurze Verzögerung für die Transition
        setTimeout(() => {
            aboutOverlay.style.visibility = 'visible';
            aboutOverlay.style.opacity = '1';
        }, 10);
    });

    aboutOverlay.addEventListener("click", () => {
        aboutOverlay.style.opacity = '0';
        setTimeout(() => {
            aboutOverlay.style.visibility = 'hidden';
            aboutOverlay.style.display = 'none';
        }, 500); // Entspricht der CSS Transition-Dauer
    });
}
});
