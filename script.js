/* NovaBlog — vanilla JS blogging app
   Notes:
   - Multi-page feel is done via hash routes (#/blogs, #/create, #/blog?id=...)
   - Data is stored in localStorage only (no backend).
*/

(() => {
  "use strict";

  // ---------------------------
  // Storage keys + helpers
  // ---------------------------
  const STORAGE = {
    BLOGS: "novablog.blogs.v1",
    THEME: "novablog.theme.v1",
  };

  /** @returns {string} */
  function uid() {
    // Compact unique ID suitable for localStorage records
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /** @returns {number} */
  function now() {
    return Date.now();
  }

  /** @param {unknown} v */
  function safeString(v) {
    return typeof v === "string" ? v : "";
  }

  /** @param {string} text */
  function normalize(text) {
    return safeString(text).trim().toLowerCase();
  }

  /** @param {string} text */
  function clampText(text, max = 140) {
    const t = safeString(text).trim();
    if (t.length <= max) return t;
    return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
  }

  /** @param {number} ts */
  function formatDate(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return "";
    }
  }

  /** @param {string} s */
  function escapeHtml(s) {
    return safeString(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  /** @param {string} url */
  function isProbablyUrl(url) {
    const u = safeString(url).trim();
    if (!u) return false;
    try {
      // Allow only http(s) to avoid file:// or javascript: injection
      const parsed = new URL(u);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function loadBlogs() {
    const raw = localStorage.getItem(STORAGE.BLOGS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** @param {any[]} blogs */
  function saveBlogs(blogs) {
    localStorage.setItem(STORAGE.BLOGS, JSON.stringify(blogs));
  }

  /** @param {string} id */
  function getBlogById(id) {
    const blogs = loadBlogs();
    return blogs.find((b) => b && b.id === id) || null;
  }

  // ---------------------------
  // Routing
  // ---------------------------
  function parseRoute() {
    const hash = window.location.hash || "#/";
    const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
    const [pathRaw, qsRaw] = cleaned.split("?");
    const path = pathRaw && pathRaw.startsWith("/") ? pathRaw : "/";
    const params = new URLSearchParams(qsRaw || "");
    return { path, params };
  }

  function setActivePage(path) {
    const pages = document.querySelectorAll(".page");
    pages.forEach((p) => p.classList.remove("page--active"));

    /** @type {HTMLElement | null} */
    let target = null;
    for (const page of pages) {
      if (page instanceof HTMLElement && page.dataset.route === path) {
        target = page;
        break;
      }
    }

    if (!target) target = document.querySelector('[data-route="/"]');
    if (target) target.classList.add("page--active");

    // Highlight active nav link
    const links = document.querySelectorAll(".nav__link");
    links.forEach((a) => a.classList.remove("is-active"));
    const activeHref = `#${path}`;
    for (const a of links) {
      if (a instanceof HTMLAnchorElement && a.getAttribute("href") === activeHref) {
        a.classList.add("is-active");
        break;
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------------------------
  // Theme
  // ---------------------------
  function getTheme() {
    const saved = safeString(localStorage.getItem(STORAGE.THEME)).trim();
    if (saved === "light" || saved === "dark") return saved;
    return "dark"; // dark by default
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE.THEME, theme);
    const label = document.getElementById("themeToggleLabel");
    if (label) label.textContent = theme === "dark" ? "Light" : "Dark";
  }

  function toggleTheme() {
    const next = getTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
  }

  // ---------------------------
  // UI rendering
  // ---------------------------
  const state = {
    list: {
      q: "",
      author: "",
      sort: "newest",
      page: 1,
      pageSize: 9,
    },
    viewingId: "",
  };

  function blogStats(blogs) {
    const total = blogs.length;
    const totalLikes = blogs.reduce((sum, b) => sum + (Number(b.likes) || 0), 0);
    const totalComments = blogs.reduce((sum, b) => sum + (Array.isArray(b.comments) ? b.comments.length : 0), 0);
    return { total, totalLikes, totalComments };
  }

  function renderHome() {
    const blogs = loadBlogs();
    const statsEl = document.getElementById("homeStats");
    if (statsEl) {
      const s = blogStats(blogs);
      statsEl.innerHTML = `
        <span class="pill"><strong>${s.total}</strong> posts</span>
        <span class="pill"><strong>${s.totalLikes}</strong> likes</span>
        <span class="pill"><strong>${s.totalComments}</strong> comments</span>
      `;
    }

    const featured = [...blogs].sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0)).slice(0, 3);
    const grid = document.getElementById("featuredGrid");
    if (!grid) return;
    if (featured.length === 0) {
      grid.innerHTML = `
        <div class="card card--pad">
          <h3 style="margin:0 0 6px;">No posts yet</h3>
          <p class="muted" style="margin:0 0 12px;">Create your first blog post to see it here.</p>
          <a class="btn btn--primary" href="#/create">Create a post</a>
        </div>
      `;
      return;
    }
    grid.innerHTML = featured.map((b) => blogCardHtml(b)).join("");
    wireCardButtons(grid);
  }

  /** @param {any} blog */
  function blogCardHtml(blog) {
    const id = safeString(blog?.id);
    const title = escapeHtml(safeString(blog?.title));
    const author = escapeHtml(safeString(blog?.author));
    const preview = escapeHtml(clampText(safeString(blog?.content), 140));
    const likes = Number(blog?.likes) || 0;
    const createdAt = Number(blog?.createdAt) || 0;
    const img = safeString(blog?.imageUrl);
    const hasImg = isProbablyUrl(img);
    const imgHtml = hasImg ? `<img src="${escapeHtml(img)}" alt="${title}" loading="lazy" />` : "";

    return `
      <article class="card" data-blog-id="${escapeHtml(id)}">
        <div class="card__img">${imgHtml}</div>
        <div class="card__body">
          <h3 class="card__title">${title || "Untitled"}</h3>
          <div class="card__meta">
            <span>By <strong>${author || "Unknown"}</strong></span>
            <span>•</span>
            <span>${escapeHtml(formatDate(createdAt))}</span>
          </div>
          <p class="card__preview">${preview || "No content yet."}</p>
          <div class="card__actions">
            <div class="row">
              <button class="btn btn--ghost js-like" type="button" data-id="${escapeHtml(id)}" aria-label="Like post">
                <span aria-hidden="true">♥</span>
                <span class="js-like-count">${likes}</span>
              </button>
              <a class="btn btn--primary" href="#/blog?id=${encodeURIComponent(id)}">Read more</a>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  /** @param {HTMLElement} root */
  function wireCardButtons(root) {
    const likeButtons = root.querySelectorAll(".js-like");
    likeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id") || "";
        likeBlog(id);
        // Update count in-place for responsiveness
        const updated = getBlogById(id);
        const countEl = btn.querySelector(".js-like-count");
        if (countEl) countEl.textContent = String(Number(updated?.likes) || 0);
      });
    });
  }

  function getFilteredSortedBlogs() {
    const all = loadBlogs();
    const q = normalize(state.list.q);
    const a = normalize(state.list.author);

    let filtered = all.filter((b) => {
      const title = normalize(b?.title);
      const author = normalize(b?.author);
      const okTitle = q ? title.includes(q) : true;
      const okAuthor = a ? author.includes(a) : true;
      return okTitle && okAuthor;
    });

    const sort = state.list.sort;
    if (sort === "oldest") {
      filtered.sort((x, y) => (Number(x.createdAt) || 0) - (Number(y.createdAt) || 0));
    } else if (sort === "title") {
      filtered.sort((x, y) => normalize(x?.title).localeCompare(normalize(y?.title)));
    } else if (sort === "likes") {
      filtered.sort((x, y) => (Number(y.likes) || 0) - (Number(x.likes) || 0));
    } else {
      filtered.sort((x, y) => (Number(y.createdAt) || 0) - (Number(x.createdAt) || 0));
    }

    return filtered;
  }

  function renderListing() {
    const grid = document.getElementById("blogGrid");
    const status = document.getElementById("listStatus");
    const pager = document.getElementById("pager");
    const pagerMeta = document.getElementById("pagerMeta");
    if (!grid || !status || !pager || !pagerMeta) return;

    const filtered = getFilteredSortedBlogs();
    const total = filtered.length;
    const pageSize = Math.max(1, Number(state.list.pageSize) || 9);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    state.list.page = Math.min(Math.max(1, state.list.page), totalPages);

    const start = (state.list.page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);

    status.textContent = total === 0 ? "No posts found. Try clearing filters or create a new post." : `Showing ${slice.length} of ${total} posts`;
    grid.innerHTML = slice.map((b) => blogCardHtml(b)).join("");
    wireCardButtons(grid);

    pagerMeta.textContent = `Page ${state.list.page} of ${totalPages}`;
    pager.style.display = total > pageSize ? "flex" : "none";

    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    if (prevBtn) prevBtn.disabled = state.list.page <= 1;
    if (nextBtn) nextBtn.disabled = state.list.page >= totalPages;
  }

  /** @param {any} blog */
  function renderSingle(blog) {
    const postEl = document.getElementById("postView");
    if (!postEl) return;

    if (!blog) {
      postEl.innerHTML = `
        <div class="card card--pad">
          <h2 style="margin:0 0 8px;">Post not found</h2>
          <p class="muted" style="margin:0 0 12px;">It may have been deleted.</p>
          <a class="btn btn--primary" href="#/blogs">Go to Blogs</a>
        </div>
      `;
      return;
    }

    const id = safeString(blog.id);
    state.viewingId = id;
    const title = escapeHtml(safeString(blog.title));
    const author = escapeHtml(safeString(blog.author));
    const createdAt = Number(blog.createdAt) || 0;
    const updatedAt = Number(blog.updatedAt) || 0;
    const likes = Number(blog.likes) || 0;
    const img = safeString(blog.imageUrl);
    const hasImg = isProbablyUrl(img);
    const imgHtml = hasImg ? `<img src="${escapeHtml(img)}" alt="${title}" />` : "";
    const content = escapeHtml(safeString(blog.content));

    postEl.innerHTML = `
      <div class="post__img">${imgHtml}</div>
      <div class="post__body">
        <h2 class="post__title">${title || "Untitled"}</h2>
        <div class="post__meta">
          <span>By <strong>${author || "Unknown"}</strong></span>
          <span>•</span>
          <span>Published ${escapeHtml(formatDate(createdAt))}</span>
          ${updatedAt && updatedAt !== createdAt ? `<span>•</span><span>Updated ${escapeHtml(formatDate(updatedAt))}</span>` : ""}
        </div>
        <div class="row" style="margin:0 0 10px;">
          <button class="btn btn--ghost" type="button" id="singleLikeBtn" aria-label="Like post">
            <span aria-hidden="true">♥</span>
            <span id="singleLikeCount">${likes}</span>
          </button>
        </div>
        <div class="post__content">${content}</div>

        <div class="post__actions">
          <div class="row">
            <button class="btn btn--primary" type="button" id="editBtn">Edit</button>
            <button class="btn btn--danger" type="button" id="deleteBtn">Delete</button>
          </div>
          <div class="row">
            <a class="btn btn--ghost" href="#/blogs">Back</a>
          </div>
        </div>
      </div>
    `;

    const likeBtn = document.getElementById("singleLikeBtn");
    if (likeBtn) {
      likeBtn.addEventListener("click", () => {
        likeBlog(id);
        const updated = getBlogById(id);
        const count = document.getElementById("singleLikeCount");
        if (count) count.textContent = String(Number(updated?.likes) || 0);
        // Listing/home might be visible later; keep them fresh when navigating
      });
    }

    const delBtn = document.getElementById("deleteBtn");
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        const ok = window.confirm("Delete this post? This cannot be undone.");
        if (!ok) return;
        deleteBlog(id);
        window.location.hash = "#/blogs";
      });
    }

    const editBtn = document.getElementById("editBtn");
    if (editBtn) {
      editBtn.addEventListener("click", () => openEditModal(id));
    }
  }

  function renderComments() {
    const listEl = document.getElementById("commentsList");
    if (!listEl) return;
    const blog = getBlogById(state.viewingId);
    const comments = Array.isArray(blog?.comments) ? blog.comments : [];

    if (!blog) {
      listEl.innerHTML = "";
      return;
    }

    if (comments.length === 0) {
      listEl.innerHTML = `
        <div class="comment">
          <div class="comment__head"><span class="comment__name">No comments yet</span></div>
          <p class="comment__text">Be the first to comment.</p>
        </div>
      `;
      return;
    }

    const sorted = [...comments].sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    listEl.innerHTML = sorted
      .map((c) => {
        const name = escapeHtml(safeString(c?.name));
        const text = escapeHtml(safeString(c?.text));
        const ts = Number(c?.createdAt) || 0;
        return `
          <div class="comment">
            <div class="comment__head">
              <span class="comment__name">${name || "Anonymous"}</span>
              <span>${escapeHtml(formatDate(ts))}</span>
            </div>
            <p class="comment__text">${text}</p>
          </div>
        `;
      })
      .join("");
  }

  // ---------------------------
  // Data operations (CRUD)
  // ---------------------------
  function createBlog({ title, author, imageUrl, content }) {
    const blogs = loadBlogs();
    const t = safeString(title).trim();
    const a = safeString(author).trim();
    const c = safeString(content).trim();
    const img = safeString(imageUrl).trim();

    const blog = {
      id: uid(),
      title: t,
      author: a,
      imageUrl: img,
      content: c,
      createdAt: now(),
      updatedAt: now(),
      likes: 0,
      comments: [],
    };

    blogs.unshift(blog);
    saveBlogs(blogs);
    return blog;
  }

  function updateBlog(id, patch) {
    const blogs = loadBlogs();
    const idx = blogs.findIndex((b) => b && b.id === id);
    if (idx < 0) return null;
    const current = blogs[idx];
    const next = {
      ...current,
      ...patch,
      updatedAt: now(),
    };
    blogs[idx] = next;
    saveBlogs(blogs);
    return next;
  }

  function deleteBlog(id) {
    const blogs = loadBlogs();
    const next = blogs.filter((b) => b && b.id !== id);
    saveBlogs(next);
  }

  function likeBlog(id) {
    const blog = getBlogById(id);
    if (!blog) return;
    const likes = (Number(blog.likes) || 0) + 1;
    updateBlog(id, { likes });
    // Keep listing in sync if user is on listing
    const { path } = parseRoute();
    if (path === "/blogs") renderListing();
    if (path === "/") renderHome();
  }

  function addComment(id, { name, text }) {
    const blog = getBlogById(id);
    if (!blog) return null;
    const comments = Array.isArray(blog.comments) ? blog.comments : [];
    const next = [
      ...comments,
      {
        id: uid(),
        name: safeString(name).trim(),
        text: safeString(text).trim(),
        createdAt: now(),
      },
    ];
    return updateBlog(id, { comments: next });
  }

  // ---------------------------
  // Edit modal
  // ---------------------------
  function openEditModal(id) {
    const modal = document.getElementById("editModal");
    if (!(modal instanceof HTMLDialogElement)) return;
    const blog = getBlogById(id);
    if (!blog) return;

    const t = document.getElementById("editTitleInput");
    const a = document.getElementById("editAuthorInput");
    const i = document.getElementById("editImageInput");
    const c = document.getElementById("editContentInput");
    if (t) t.value = safeString(blog.title);
    if (a) a.value = safeString(blog.author);
    if (i) i.value = safeString(blog.imageUrl);
    if (c) c.value = safeString(blog.content);

    modal.dataset.editingId = id;
    modal.showModal();
  }

  function wireEditModal() {
    const modal = document.getElementById("editModal");
    const form = document.getElementById("editForm");
    if (!(modal instanceof HTMLDialogElement) || !(form instanceof HTMLFormElement)) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // Respect dialog-style cancel buttons
      const submitter = /** @type {HTMLButtonElement | null} */ (e.submitter || null);
      if (submitter?.value === "cancel") {
        modal.close();
        return;
      }

      const id = safeString(modal.dataset.editingId);
      if (!id) return;

      const t = document.getElementById("editTitleInput");
      const a = document.getElementById("editAuthorInput");
      const i = document.getElementById("editImageInput");
      const c = document.getElementById("editContentInput");

      const title = safeString(t?.value).trim();
      const author = safeString(a?.value).trim();
      const imageUrl = safeString(i?.value).trim();
      const content = safeString(c?.value).trim();

      if (title.length === 0 || author.length === 0 || content.length < 40) {
        window.alert("Please provide a title, author, and at least 40 characters of content.");
        return;
      }

      updateBlog(id, { title, author, imageUrl, content });
      modal.close();

      // Re-render current views
      const { path, params } = parseRoute();
      if (path === "/blog") {
        const currentId = params.get("id") || id;
        renderSingle(getBlogById(currentId));
        renderComments();
      }
      renderListing();
      renderHome();
    });
  }

  // ---------------------------
  // Page wiring
  // ---------------------------
  function wireNav() {
    const toggle = document.getElementById("navToggle");
    const menu = document.getElementById("navMenu");
    if (!toggle || !menu) return;
    toggle.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    menu.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function wireCreateForm() {
    const form = document.getElementById("createForm");
    if (!(form instanceof HTMLFormElement)) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = safeString(document.getElementById("titleInput")?.value).trim();
      const author = safeString(document.getElementById("authorInput")?.value).trim();
      const imageUrl = safeString(document.getElementById("imageInput")?.value).trim();
      const content = safeString(document.getElementById("contentInput")?.value).trim();

      if (title.length === 0 || author.length === 0 || content.length < 40) {
        window.alert("Please fill Title, Author, and at least 40 characters of Content.");
        return;
      }

      const blog = createBlog({ title, author, imageUrl, content });
      form.reset();
      renderHome();
      renderListing();
      window.location.hash = `#/blog?id=${encodeURIComponent(blog.id)}`;
    });

    const seedBtn = document.getElementById("seedBtn");
    if (seedBtn) {
      seedBtn.addEventListener("click", () => {
        seedDemoPosts();
        renderHome();
        renderListing();
        window.location.hash = "#/blogs";
      });
    }

    const clearAllBtn = document.getElementById("clearAllBtn");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        const ok = window.confirm("Clear ALL posts, likes, and comments? This cannot be undone.");
        if (!ok) return;
        saveBlogs([]);
        renderHome();
        renderListing();
        window.location.hash = "#/";
      });
    }
  }

  function wireListingControls() {
    const search = document.getElementById("searchInput");
    const author = document.getElementById("authorFilterInput");
    const sort = document.getElementById("sortSelect");
    const pageSize = document.getElementById("pageSizeSelect");
    const prev = document.getElementById("prevPageBtn");
    const next = document.getElementById("nextPageBtn");

    if (search) {
      search.addEventListener("input", () => {
        state.list.q = safeString(search.value);
        state.list.page = 1;
        renderListing();
      });
    }
    if (author) {
      author.addEventListener("input", () => {
        state.list.author = safeString(author.value);
        state.list.page = 1;
        renderListing();
      });
    }
    if (sort) {
      sort.addEventListener("change", () => {
        state.list.sort = safeString(sort.value);
        state.list.page = 1;
        renderListing();
      });
    }
    if (pageSize) {
      pageSize.addEventListener("change", () => {
        state.list.pageSize = Number(pageSize.value) || 9;
        state.list.page = 1;
        renderListing();
      });
    }
    if (prev) {
      prev.addEventListener("click", () => {
        state.list.page = Math.max(1, state.list.page - 1);
        renderListing();
      });
    }
    if (next) {
      next.addEventListener("click", () => {
        state.list.page = state.list.page + 1;
        renderListing();
      });
    }
  }

  function wireCommentForm() {
    const form = document.getElementById("commentForm");
    if (!(form instanceof HTMLFormElement)) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = safeString(document.getElementById("commentName")?.value).trim();
      const text = safeString(document.getElementById("commentText")?.value).trim();
      if (!state.viewingId) return;
      if (name.length === 0 || text.length === 0) return;

      addComment(state.viewingId, { name, text });
      form.reset();
      renderComments();
      renderHome();
      renderListing();
    });
  }

  function wireThemeToggle() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    btn.addEventListener("click", toggleTheme);
  }

  // ---------------------------
  // Seed demo data
  // ---------------------------
  function seedDemoPosts() {
    const existing = loadBlogs();
    if (existing.length >= 3) return;

    const samples = [
      {
        title: "Designing a clean dark UI",
        author: "Nova Team",
        imageUrl: "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1400&q=80",
        content:
          "Dark mode isn’t just inverted colors. Use layered surfaces, soft borders, and consistent spacing.\n\nThis demo post shows how a card-based layout, subtle shadows, and good typography can feel professional without any framework.\n\nTry toggling theme, liking posts, adding comments, and editing content.",
      },
      {
        title: "Writing better blog previews",
        author: "Ariba",
        imageUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1400&q=80",
        content:
          "A good preview is short, clear, and makes the reader curious.\n\nIn NovaBlog, previews are generated from your content automatically, but you still control the first paragraph — so start strong.\n\nUse headings, short paragraphs, and a helpful tone.",
      },
      {
        title: "Local-first apps: why they feel fast",
        author: "Nova Team",
        imageUrl: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=1400&q=80",
        content:
          "Local-first means your data lives on the device, and syncing is optional.\n\nThis project stores everything in localStorage, which makes interactions instant. It also keeps the code simple.\n\nIf you later add a backend, you can keep the same UI and swap the storage layer.",
      },
    ];

    const blogs = loadBlogs();
    samples.forEach((s) => {
      const b = createBlog(s);
      // sprinkle a couple likes/comments
      const extraLikes = Math.floor(Math.random() * 7);
      if (extraLikes) updateBlog(b.id, { likes: extraLikes });
      if (Math.random() > 0.5) {
        addComment(b.id, { name: "Reader", text: "This looks great. Love the clean UI!" });
      }
    });

    // createBlog already saves; nothing else needed
    saveBlogs(loadBlogs());
  }

  // ---------------------------
  // Route handler
  // ---------------------------
  function handleRoute() {
    const { path, params } = parseRoute();
    setActivePage(path);

    if (path === "/") {
      renderHome();
      return;
    }

    if (path === "/blogs") {
      renderListing();
      return;
    }

    if (path === "/blog") {
      const id = safeString(params.get("id"));
      const blog = getBlogById(id);
      renderSingle(blog);
      renderComments();
      return;
    }

    if (path === "/create") {
      // nothing special; form wiring is global
      return;
    }

    if (path === "/about") {
      return;
    }

    // Fallback
    window.location.hash = "#/";
  }

  // ---------------------------
  // Init
  // ---------------------------
  function init() {
    applyTheme(getTheme());
    wireThemeToggle();
    wireNav();
    wireCreateForm();
    wireListingControls();
    wireEditModal();
    wireCommentForm();

    // Ensure a route exists
    if (!window.location.hash) window.location.hash = "#/";
    handleRoute();

    window.addEventListener("hashchange", handleRoute);
  }

  document.addEventListener("DOMContentLoaded", init);
})();

