(() => {
  "use strict";

  const SESSION_KEY = "musicloud-web-session";
  const state = {
    session: readSession(),
    songs: [],
    visibleSongs: [],
    playlists: [],
    activePlaylistId: null,
    currentView: "discover",
    authMode: "login",
    selectedSongId: null,
    requestSequence: 0,
    toastTimer: null
  };

  const elements = {
    serviceStatus: document.getElementById("service-status"),
    serviceStatusText: document.getElementById("service-status-text"),
    sidebarAccount: document.getElementById("sidebar-account"),
    topbarActions: document.getElementById("topbar-actions"),
    discoverNav: document.getElementById("discover-nav"),
    playlistsNav: document.getElementById("playlists-nav"),
    discoverView: document.getElementById("discover-view"),
    playlistsView: document.getElementById("playlists-view"),
    searchInput: document.getElementById("search-input"),
    genreFilter: document.getElementById("genre-filter"),
    songGrid: document.getElementById("song-grid"),
    catalogEmpty: document.getElementById("catalog-empty"),
    catalogLoading: document.getElementById("catalog-loading"),
    songCount: document.getElementById("song-count"),
    genreCount: document.getElementById("genre-count"),
    playlistCount: document.getElementById("playlist-count"),
    playlistList: document.getElementById("playlist-list"),
    playlistDetail: document.getElementById("playlist-detail"),
    authModal: document.getElementById("auth-modal"),
    authFields: document.getElementById("auth-fields"),
    authForm: document.getElementById("auth-form"),
    authError: document.getElementById("auth-error"),
    authSubmit: document.getElementById("auth-submit"),
    playlistModal: document.getElementById("playlist-modal"),
    playlistChoice: document.getElementById("playlist-choice"),
    playlistError: document.getElementById("playlist-error"),
    createPlaylistModal: document.getElementById("create-playlist-modal"),
    createPlaylistForm: document.getElementById("create-playlist-form"),
    createPlaylistError: document.getElementById("create-playlist-error"),
    audio: document.getElementById("audio-player"),
    playToggle: document.getElementById("play-toggle"),
    progressFill: document.getElementById("progress-fill"),
    playerTime: document.getElementById("player-time"),
    playerTitle: document.getElementById("player-title"),
    playerArtist: document.getElementById("player-artist"),
    playerArt: document.getElementById("player-art"),
    toast: document.getElementById("toast")
  };

  function readSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      return session && typeof session.accessToken === "string" ? session : null;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, window.location.origin);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch {
      return null;
    }
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (state.session?.accessToken) headers.set("Authorization", `Bearer ${state.session.accessToken}`);

    const response = await fetch(path, { ...options, headers });
    const raw = await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }
    }

    if (response.status === 401 && state.session) {
      clearSession();
      showToast("Your session expired. Please sign in again.", true);
    }
    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Request failed (${response.status}).`);
    }
    return data;
  }

  function showToast(message, isError = false) {
    clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("is-error", isError);
    elements.toast.classList.add("is-visible");
    state.toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
  }

  function setServiceStatus(isOnline) {
    elements.serviceStatus.classList.toggle("is-online", isOnline);
    elements.serviceStatus.classList.toggle("is-offline", !isOnline);
    elements.serviceStatusText.textContent = isOnline ? "MusicLoud is online" : "Service unavailable";
  }

  function initials(text) {
    return String(text || "M")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("") || "M";
  }

  function renderAccount() {
    const signedIn = Boolean(state.session);
    const displayName = state.session?.fullName || state.session?.username || "Listener";

    elements.sidebarAccount.innerHTML = signedIn
      ? `<button class="account-card" type="button" data-action="logout" aria-label="Sign out">
          <span class="avatar">${escapeHtml(initials(displayName))}</span>
          <span class="account-copy"><strong>${escapeHtml(displayName)}</strong><span>Sign out</span></span>
        </button>`
      : `<button class="account-card" type="button" data-action="open-login">
          <span class="avatar">♫</span>
          <span class="account-copy"><strong>Make it yours</strong><span>Sign in or join free</span></span>
        </button>`;

    elements.topbarActions.innerHTML = signedIn
      ? `<button class="outline-button" type="button" data-action="logout">Sign out</button>`
      : `<button class="text-button" type="button" data-action="open-login">Sign in</button>
         <button class="outline-button" type="button" data-action="open-register">Create account</button>`;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return "—";
    const total = Math.floor(Number(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function songCard(song, playlistId = null) {
    const coverUrl = safeUrl(song.coverUrl);
    const audioUrl = safeUrl(song.audioUrl);
    const cover = coverUrl
      ? `<img src="${escapeHtml(coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : `<span class="cover-placeholder" aria-hidden="true">♫</span>`;
    const addAction = playlistId === null
      ? `<button class="small-button" type="button" data-action="add-song" data-song-id="${Number(song.id)}">＋ Add</button>`
      : `<button class="small-button" type="button" data-action="remove-song" data-song-id="${Number(song.id)}" data-playlist-id="${Number(playlistId)}">Remove</button>`;

    return `<article class="song-card">
      <div class="song-cover">${cover}<span class="song-cover-badge">${escapeHtml(song.genre || "Music")}</span></div>
      <div class="song-info">
        <h3 class="song-title" title="${escapeHtml(song.title)}">${escapeHtml(song.title || "Untitled")}</h3>
        <p class="song-artist" title="${escapeHtml(song.artist)}">${escapeHtml(song.artist || "Unknown artist")}</p>
        <div class="song-meta"><span>${escapeHtml(song.releaseYear || "—")}</span><span>${formatDuration(song.durationSeconds)}</span></div>
        <div class="song-actions">
          <button class="icon-button play-song" type="button" data-action="play-song" data-song-id="${Number(song.id)}" aria-label="Play ${escapeHtml(song.title)}" ${audioUrl ? "" : "disabled"}>▶</button>
          ${addAction}
        </div>
      </div>
    </article>`;
  }

  function attachCoverFallbacks(container) {
    container.querySelectorAll(".song-cover img").forEach(image => {
      image.addEventListener("error", () => {
        const fallback = document.createElement("span");
        fallback.className = "cover-placeholder";
        fallback.setAttribute("aria-hidden", "true");
        fallback.textContent = "♫";
        image.replaceWith(fallback);
      }, { once: true });
    });
  }

  function renderSongGrid(songs, container, playlistId = null) {
    container.innerHTML = songs.map(song => songCard(song, playlistId)).join("");
    attachCoverFallbacks(container);
  }

  function populateGenres(songs) {
    const selected = elements.genreFilter.value || "all";
    const genres = [...new Set(songs.map(song => song.genre).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    elements.genreFilter.innerHTML = `<option value="all">All genres</option>${genres.map(genre =>
      `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join("")}`;
    if (genres.includes(selected)) elements.genreFilter.value = selected;
    elements.genreCount.textContent = String(genres.length);
  }

  async function loadSongs() {
    elements.catalogLoading.hidden = false;
    elements.catalogEmpty.hidden = true;
    try {
      state.songs = await api("/api/songs");
      elements.songCount.textContent = String(state.songs.length);
      populateGenres(state.songs);
      await searchSongs();
    } catch (error) {
      elements.catalogLoading.hidden = true;
      elements.catalogEmpty.hidden = false;
      elements.catalogEmpty.querySelector("h3").textContent = "Could not load the library";
      elements.catalogEmpty.querySelector("p").textContent = error.message;
      setServiceStatus(false);
    }
  }

  async function searchSongs() {
    const sequence = ++state.requestSequence;
    const query = elements.searchInput.value.trim();
    elements.catalogLoading.hidden = false;
    try {
      const result = await api(`/api/songs/search?q=${encodeURIComponent(query)}`);
      if (sequence !== state.requestSequence) return;
      const genre = elements.genreFilter.value;
      state.visibleSongs = genre === "all" ? result : result.filter(song => song.genre?.toLowerCase() === genre.toLowerCase());
      renderSongGrid(state.visibleSongs, elements.songGrid);
      elements.catalogLoading.hidden = true;
      elements.catalogEmpty.hidden = state.visibleSongs.length > 0;
      elements.catalogEmpty.querySelector("h3").textContent = "No songs found";
      elements.catalogEmpty.querySelector("p").textContent = "Try another search or choose a different genre.";
      setServiceStatus(true);
    } catch (error) {
      if (sequence !== state.requestSequence) return;
      elements.catalogLoading.hidden = true;
      elements.catalogEmpty.hidden = false;
      elements.catalogEmpty.querySelector("h3").textContent = "Could not load the library";
      elements.catalogEmpty.querySelector("p").textContent = error.message;
      setServiceStatus(false);
    }
  }

  async function loadPlaylists() {
    if (!state.session) {
      state.playlists = [];
      state.activePlaylistId = null;
      renderPlaylists();
      return;
    }
    try {
      state.playlists = await api("/api/playlists");
      if (!state.playlists.some(playlist => playlist.id === state.activePlaylistId)) {
        state.activePlaylistId = state.playlists[0]?.id ?? null;
      }
      renderPlaylists();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function renderPlaylists() {
    elements.playlistCount.textContent = String(state.playlists.length);
    if (!state.session) {
      elements.playlistList.innerHTML = `<div class="empty-state"><span class="empty-icon">♫</span><h3>Sign in to make playlists</h3><p>Your mixes stay with your account.</p><button class="primary-button" type="button" data-action="open-login">Sign in</button></div>`;
      elements.playlistDetail.innerHTML = "";
      return;
    }

    if (state.playlists.length === 0) {
      elements.playlistList.innerHTML = `<div class="empty-state"><span class="empty-icon">♫</span><h3>No playlists yet</h3><p>Create a playlist to start collecting songs.</p></div>`;
      elements.playlistDetail.innerHTML = `<div class="empty-state"><span class="empty-icon">✦</span><h3>Your next favorite mix starts here</h3><p>Create a playlist, then add songs from Discover.</p></div>`;
      return;
    }

    elements.playlistList.innerHTML = state.playlists.map(playlist => `
      <button class="playlist-row ${playlist.id === state.activePlaylistId ? "is-selected" : ""}" type="button" data-action="select-playlist" data-playlist-id="${Number(playlist.id)}">
        <span class="playlist-row-icon" aria-hidden="true">♫</span>
        <span class="playlist-row-copy"><strong>${escapeHtml(playlist.name)}</strong><span>${playlist.songs.length} ${playlist.songs.length === 1 ? "song" : "songs"}</span></span>
      </button>`).join("");

    const active = state.playlists.find(playlist => playlist.id === state.activePlaylistId);
    if (!active) {
      elements.playlistDetail.innerHTML = "";
      return;
    }

    elements.playlistDetail.innerHTML = `
      <div class="playlist-detail-head">
        <div><h3>${escapeHtml(active.name)}</h3><p>${active.songs.length} ${active.songs.length === 1 ? "song" : "songs"} in this collection</p></div>
        <button class="small-button" type="button" data-action="delete-playlist" data-playlist-id="${Number(active.id)}">Delete playlist</button>
      </div>
      ${active.songs.length ? `<div class="song-grid">${active.songs.map(song => songCard(song, active.id)).join("")}</div>` : `<div class="empty-state"><span class="empty-icon">♫</span><h3>This playlist is ready for a soundtrack</h3><p>Browse Discover and add a song to get started.</p></div>`}`;
    attachCoverFallbacks(elements.playlistDetail);
  }

  function showView(view) {
    state.currentView = view;
    const isDiscover = view === "discover";
    elements.discoverView.hidden = !isDiscover;
    elements.playlistsView.hidden = isDiscover;
    elements.discoverNav.classList.toggle("is-active", isDiscover);
    elements.playlistsNav.classList.toggle("is-active", !isDiscover);
    if (!isDiscover) loadPlaylists();
  }

  function openModal(modal) {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    const focusTarget = modal.querySelector("input, select, button");
    focusTarget?.focus();
  }

  function closeModal(modal) {
    modal.hidden = true;
    if ([elements.authModal, elements.playlistModal, elements.createPlaylistModal].every(item => item.hidden)) {
      document.body.style.overflow = "";
    }
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const isRegister = mode === "register";
    document.getElementById("auth-eyebrow").textContent = isRegister ? "JOIN THE COMMUNITY" : "WELCOME BACK";
    document.getElementById("auth-title").textContent = isRegister ? "Create your account" : "Sign in to your space";
    document.getElementById("auth-copy").textContent = isRegister
      ? "Build playlists and keep your music close."
      : "Your playlists are only a beat away.";
    document.getElementById("login-tab").classList.toggle("is-active", !isRegister);
    document.getElementById("login-tab").setAttribute("aria-selected", String(!isRegister));
    document.getElementById("register-tab").classList.toggle("is-active", isRegister);
    document.getElementById("register-tab").setAttribute("aria-selected", String(isRegister));
    elements.authSubmit.textContent = isRegister ? "Create account" : "Sign in";
    elements.authError.textContent = "";
    elements.authFields.innerHTML = isRegister
      ? `<div class="form-fields">
          <label class="field"><span class="field-label">First name</span><input name="firstName" required maxlength="50" autocomplete="given-name"></label>
          <label class="field"><span class="field-label">Last name</span><input name="lastName" required maxlength="50" autocomplete="family-name"></label>
          <label class="field is-wide"><span class="field-label">Email</span><input name="email" type="email" required autocomplete="email"></label>
          <label class="field is-wide"><span class="field-label">Username</span><input name="username" required minlength="3" maxlength="30" autocomplete="username"></label>
          <label class="field is-wide"><span class="field-label">Password</span><input name="password" type="password" required minlength="4" maxlength="72" autocomplete="new-password"></label>
        </div>`
      : `<label class="field"><span class="field-label">Username or email</span><input name="usernameOrEmail" required autocomplete="username"></label>
         <label class="field"><span class="field-label">Password</span><input name="password" type="password" required autocomplete="current-password"></label>`;
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);
    openModal(elements.authModal);
  }

  function clearSession() {
    state.session = null;
    state.playlists = [];
    state.activePlaylistId = null;
    sessionStorage.removeItem(SESSION_KEY);
    renderAccount();
    renderPlaylists();
  }

  async function submitAuth(event) {
    event.preventDefault();
    elements.authSubmit.disabled = true;
    elements.authError.textContent = "";
    const formData = new FormData(elements.authForm);
    const body = Object.fromEntries(formData.entries());
    const endpoint = state.authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    try {
      const result = await api(endpoint, { method: "POST", body: JSON.stringify(body) });
      state.session = result;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
      renderAccount();
      closeModal(elements.authModal);
      await loadPlaylists();
      showToast(`Welcome${result.fullName ? `, ${result.fullName}` : ""}!`);
      if (state.currentView === "playlists") renderPlaylists();
    } catch (error) {
      elements.authError.textContent = error.message;
    } finally {
      elements.authSubmit.disabled = false;
    }
  }

  function openAddSong(songId) {
    if (!state.session) {
      openAuth("login");
      showToast("Sign in to save songs to a playlist.");
      return;
    }
    if (state.playlists.length === 0) {
      openCreatePlaylist();
      showToast("Create a playlist first, then add this song.");
      return;
    }
    const song = state.songs.find(item => Number(item.id) === Number(songId))
      || state.playlists.flatMap(playlist => playlist.songs).find(item => Number(item.id) === Number(songId));
    state.selectedSongId = Number(songId);
    document.getElementById("playlist-modal-song").textContent = song ? `${song.title} — ${song.artist}` : "Choose where to save this song.";
    elements.playlistChoice.innerHTML = state.playlists.map(playlist =>
      `<option value="${Number(playlist.id)}">${escapeHtml(playlist.name)}</option>`).join("");
    elements.playlistError.textContent = "";
    openModal(elements.playlistModal);
  }

  function openCreatePlaylist() {
    if (!state.session) {
      openAuth("login");
      showToast("Sign in to create a playlist.");
      return;
    }
    elements.createPlaylistError.textContent = "";
    elements.createPlaylistForm.reset();
    openModal(elements.createPlaylistModal);
  }

  async function addSongToPlaylist(event) {
    event.preventDefault();
    const playlistId = Number(elements.playlistChoice.value);
    try {
      await api(`/api/playlists/${playlistId}/songs/${state.selectedSongId}`, { method: "POST" });
      closeModal(elements.playlistModal);
      await loadPlaylists();
      showToast("Song added to your playlist.");
    } catch (error) {
      elements.playlistError.textContent = error.message;
    }
  }

  async function createPlaylist(event) {
    event.preventDefault();
    const submit = elements.createPlaylistForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    elements.createPlaylistError.textContent = "";
    const name = new FormData(elements.createPlaylistForm).get("name");
    try {
      const playlist = await api("/api/playlists", { method: "POST", body: JSON.stringify({ name }) });
      state.playlists.unshift(playlist);
      state.activePlaylistId = playlist.id;
      closeModal(elements.createPlaylistModal);
      renderPlaylists();
      showToast("Playlist created.");
      if (state.currentView === "playlists") showView("playlists");
    } catch (error) {
      elements.createPlaylistError.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  }

  async function deletePlaylist(playlistId) {
    const playlist = state.playlists.find(item => Number(item.id) === Number(playlistId));
    if (!playlist || !window.confirm(`Delete "${playlist.name}"? This can't be undone.`)) return;
    try {
      await api(`/api/playlists/${playlistId}`, { method: "DELETE" });
      state.playlists = state.playlists.filter(item => Number(item.id) !== Number(playlistId));
      state.activePlaylistId = state.playlists[0]?.id ?? null;
      renderPlaylists();
      showToast("Playlist deleted.");
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function removeSong(playlistId, songId) {
    try {
      await api(`/api/playlists/${playlistId}/songs/${songId}`, { method: "DELETE" });
      await loadPlaylists();
      showToast("Song removed from your playlist.");
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function playSong(songId) {
    const song = state.songs.find(item => Number(item.id) === Number(songId))
      || state.playlists.flatMap(playlist => playlist.songs).find(item => Number(item.id) === Number(songId));
    const url = safeUrl(song?.audioUrl);
    if (!song || !url) {
      showToast("A preview is not available for this song.");
      return;
    }

    if (elements.audio.src !== url) {
      elements.audio.src = url;
      elements.audio.load();
    }
    elements.playerTitle.textContent = song.title || "Untitled";
    elements.playerArtist.textContent = song.artist || "Unknown artist";
    const coverUrl = safeUrl(song.coverUrl);
    elements.playerArt.innerHTML = coverUrl
      ? `<img src="${escapeHtml(coverUrl)}" alt="">`
      : "♫";
    elements.playerArt.querySelector("img")?.addEventListener("error", () => {
      elements.playerArt.textContent = "♫";
    }, { once: true });
    elements.playToggle.disabled = false;
    elements.audio.play().catch(() => showToast("This audio preview could not be played.", true));
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const value = Math.max(0, Math.floor(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
  }

  function onDocumentClick(event) {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;

    if (action === "open-login") openAuth("login");
    if (action === "open-register") openAuth("register");
    if (action === "logout") {
      clearSession();
      showToast("You have signed out.");
    }
    if (action === "add-song") openAddSong(actionButton.dataset.songId);
    if (action === "play-song") playSong(actionButton.dataset.songId);
    if (action === "select-playlist") {
      state.activePlaylistId = Number(actionButton.dataset.playlistId);
      renderPlaylists();
    }
    if (action === "delete-playlist") deletePlaylist(actionButton.dataset.playlistId);
    if (action === "remove-song") removeSong(actionButton.dataset.playlistId, actionButton.dataset.songId);
  }

  function bindEvents() {
    elements.discoverNav.addEventListener("click", () => showView("discover"));
    elements.playlistsNav.addEventListener("click", () => {
      if (!state.session) {
        openAuth("login");
        return;
      }
      showView("playlists");
    });
    document.getElementById("hero-browse").addEventListener("click", () => {
      elements.songGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("new-playlist-button").addEventListener("click", openCreatePlaylist);
    document.getElementById("login-tab").addEventListener("click", () => setAuthMode("login"));
    document.getElementById("register-tab").addEventListener("click", () => setAuthMode("register"));
    elements.authForm.addEventListener("submit", submitAuth);
    document.getElementById("add-to-playlist-form").addEventListener("submit", addSongToPlaylist);
    elements.createPlaylistForm.addEventListener("submit", createPlaylist);
    elements.searchInput.addEventListener("input", () => {
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(searchSongs, 240);
    });
    elements.genreFilter.addEventListener("change", searchSongs);
    elements.playToggle.addEventListener("click", () => {
      if (elements.audio.paused) elements.audio.play().catch(() => showToast("This audio preview could not be played.", true));
      else elements.audio.pause();
    });
    elements.audio.addEventListener("play", () => { elements.playToggle.textContent = "Ⅱ"; });
    elements.audio.addEventListener("pause", () => { elements.playToggle.textContent = "▶"; });
    elements.audio.addEventListener("timeupdate", () => {
      const progress = elements.audio.duration ? elements.audio.currentTime / elements.audio.duration * 100 : 0;
      elements.progressFill.style.width = `${progress}%`;
      elements.playerTime.textContent = `${formatTime(elements.audio.currentTime)} / ${formatTime(elements.audio.duration)}`;
    });
    document.addEventListener("click", onDocumentClick);
    document.querySelectorAll("[data-close-modal]").forEach(button => {
      button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop")));
    });
    document.querySelectorAll(".modal-backdrop").forEach(modal => {
      modal.addEventListener("click", event => {
        if (event.target === modal) closeModal(modal);
      });
    });
    document.addEventListener("keydown", event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        elements.searchInput.focus();
      }
      if (event.key === "Escape") {
        [elements.authModal, elements.playlistModal, elements.createPlaylistModal]
          .filter(modal => !modal.hidden)
          .forEach(closeModal);
      }
    });
  }

  async function initialize() {
    bindEvents();
    renderAccount();
    renderPlaylists();
    setAuthMode("login");
    try {
      await api("/api/health");
      setServiceStatus(true);
    } catch {
      setServiceStatus(false);
    }
    await loadSongs();
    if (state.session) await loadPlaylists();
  }

  initialize();
})();
