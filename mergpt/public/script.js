/* ---------- Reveal on scroll ---------- */
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('is-visible');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach((el) => io.observe(el));

/* ---------- Merge canvas: particles converging to a core, reacting to pointer ---------- */
(function () {
  const canvas = document.getElementById('mergeCanvas');
  const ctx = canvas.getContext('2d');
  let w, h, dpr;
  let pointer = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = rect.width; h = rect.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NUM = 26;
  const particles = [];
  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < NUM; i++) {
      const angle = (i / NUM) * Math.PI * 2 + Math.random() * 0.3;
      const radius = Math.min(w, h) * 0.42;
      particles.push({
        angle,
        radius,
        speed: 0.0016 + Math.random() * 0.0016,
        wobble: Math.random() * Math.PI * 2,
        size: 1.6 + Math.random() * 2,
        hueMix: Math.random(),
      });
    }
  }
  initParticles();
  window.addEventListener('resize', initParticles);

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  });
  canvas.addEventListener('pointerleave', () => (pointer = null));

  let t = 0;
  function draw() {
    t += reduceMotion ? 0 : 1;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.42, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(79,141,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const targetX = pointer ? pointer.x : cx;
    const targetY = pointer ? pointer.y : cy;

    particles.forEach((p) => {
      p.angle += p.speed;
      const pulse = Math.sin(t * 0.01 + p.wobble) * 10;
      const r = p.radius + pulse;
      const px = cx + Math.cos(p.angle) * r;
      const py = cy + Math.sin(p.angle) * r * 0.94;

      const grad = ctx.createLinearGradient(px, py, targetX, targetY);
      grad.addColorStop(0, 'rgba(47,111,237,0.35)');
      grad.addColorStop(1, 'rgba(53,212,255,0.02)');
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(targetX + (px - targetX) * 0.72, targetY + (py - targetY) * 0.72);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.hueMix > 0.5 ? '#4f8dff' : '#35d4ff';
      ctx.fill();
    });

    const coreR = 14 + Math.sin(t * 0.02) * 2;
    const coreGrad = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, coreR * 3.4);
    coreGrad.addColorStop(0, 'rgba(53,212,255,0.9)');
    coreGrad.addColorStop(0.4, 'rgba(47,111,237,0.35)');
    coreGrad.addColorStop(1, 'rgba(47,111,237,0)');
    ctx.beginPath();
    ctx.arc(targetX, targetY, coreR * 3.4, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(targetX, targetY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e7edf7';
    ctx.fill();

    requestAnimationFrame(draw);
  }
  draw();
})();

/* ---------- Chat conectado al backend (server.js -> DeepSeek) ---------- */
(function () {
  const body = document.getElementById('chatBody');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const submitBtn = document.getElementById('chatSubmit');
  const chips = document.querySelectorAll('.chip');

  // Historial que se manda al backend en cada turno, para que DeepSeek tenga contexto.
  const history = [];

  function addMessage(text, who, isError = false) {
    const div = document.createElement('div');
    div.className = 'msg ' + who + (isError ? ' error' : '');
    if (who === 'ai') {
      div.innerHTML = '<span class="tag">MERGPT</span>';
      div.append(document.createTextNode(text));
    } else {
      div.textContent = text;
    }
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function showMerging() {
    const indicator = document.createElement('div');
    indicator.className = 'merging-indicator';
    indicator.id = 'mergingIndicator';
    indicator.innerHTML = 'fusionando rutas <span class="merge-dots"><span></span><span></span><span></span></span>';
    body.appendChild(indicator);
    body.scrollTop = body.scrollHeight;
  }

  function hideMerging() {
    const el = document.getElementById('mergingIndicator');
    if (el) el.remove();
  }

  async function respondTo(text) {
    addMessage(text, 'user');
    history.push({ role: 'user', content: text });

    input.disabled = true;
    submitBtn.disabled = true;
    showMerging();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();
      hideMerging();

      if (!res.ok) {
        addMessage(data.error || 'Hubo un error al hablar con el servidor.', 'ai', true);
        return;
      }

      addMessage(data.reply, 'ai');
      history.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      hideMerging();
      addMessage('No pude conectar con el servidor local. ¿Está corriendo "npm start"?', 'ai', true);
    } finally {
      input.disabled = false;
      submitBtn.disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    respondTo(text);
    input.value = '';
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => respondTo(chip.dataset.msg));
  });
})();
