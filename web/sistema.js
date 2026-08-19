/* Estudio · comportamiento común de las guías.
   Tema, menú, buscador, progreso de lectura, marcado de repaso y PDF. */
(function () {
  var d = document, root = d.documentElement, body = d.body;
  /* Los dos sitios se sirven desde el mismo host, así que comparten
     localStorage: sin este prefijo, el progreso de uno pisaría al del otro. */
  var SITIO = root.getAttribute('data-sitio') || 'estudio';
  var CLAVE_TEMA = SITIO + '-tema';
  var CLAVE_REPASO = SITIO + '-repaso:' + location.pathname.split('/').pop();

  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* ── tema: claro por defecto, manda también en el PDF ── */
  aplicarTema(leer(CLAVE_TEMA) === 'dark' ? 'dark' : 'light');
  function aplicarTema(t) {
    root.setAttribute('data-theme', t);
    var i = d.getElementById('tema-icono'), x = d.getElementById('tema-txt');
    if (i) i.textContent = t === 'dark' ? '☀' : '☾';
    if (x) x.textContent = t === 'dark' ? 'Claro' : 'Oscuro';
    var m = d.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', t === 'dark' ? '#151f2b' : '#ffffff');
    guardar(CLAVE_TEMA, t);
  }
  var btnTema = d.getElementById('tema'), relojTema;
  if (btnTema) btnTema.onclick = function () {
    /* la clase solo vive durante el cruce de color: fuera de aquí no hay
       transiciones globales que graven el desplazamiento ni la lectura */
    root.classList.add('mudando');
    clearTimeout(relojTema);
    relojTema = setTimeout(function () { root.classList.remove('mudando'); }, 260);
    aplicarTema(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  };

  /* ── señalar el destino de un salto ── */
  var relojDestino;
  function senalar(el) {
    if (!el || el.tagName === 'ARTICLE') return;   /* una lámina entera no se resalta */
    d.querySelectorAll('.destino').forEach(function (x) { x.classList.remove('destino'); });
    clearTimeout(relojDestino);
    void el.offsetWidth;                            /* reinicia si se salta dos veces seguidas */
    el.classList.add('destino');
    relojDestino = setTimeout(function () { el.classList.remove('destino'); }, 1200);
  }

  /* ── menú ── */
  var shell = d.getElementById('shell'), velo = d.getElementById('velo');
  var bpc = d.getElementById('menu-pc'), bmov = d.getElementById('menu-movil');
  if (bpc) bpc.onclick = function () {
    shell.classList.toggle('plegado');
    this.setAttribute('aria-expanded', String(!shell.classList.contains('plegado')));
  };
  function cerrarMovil() {
    body.classList.remove('menu-abierto');
    if (bmov) bmov.setAttribute('aria-expanded', 'false');
  }
  if (bmov) bmov.onclick = function () {
    this.setAttribute('aria-expanded', String(body.classList.toggle('menu-abierto')));
  };
  if (velo) velo.onclick = cerrarMovil;
  d.querySelectorAll('[data-jump]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (innerWidth < 1024) cerrarMovil();
      var t = d.getElementById(a.getAttribute('href').slice(1));
      if (t) setTimeout(function () { senalar(t); }, 60);
    });
  });

  /* ── progreso de lectura ── */
  var barra = d.getElementById('progreso');
  if (barra) {
    var pintar = function () {
      var h = d.documentElement.scrollHeight - innerHeight;
      barra.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
    };
    addEventListener('scroll', pintar, { passive: true });
    addEventListener('resize', pintar); pintar();
  }

  /* ── sección activa en el menú ── */
  var enlaces = {};
  d.querySelectorAll('.toc a[href^="#"]').forEach(function (a) {
    enlaces[a.getAttribute('href').slice(1)] = a;
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var a = enlaces[e.target.id];
      if (a && e.isIntersecting) {
        d.querySelectorAll('.toc a.activo').forEach(function (x) { x.classList.remove('activo'); });
        a.classList.add('activo');
      }
    });
  }, { rootMargin: '-72px 0px -70% 0px' });
  d.querySelectorAll('article.plate, h2[id]').forEach(function (o) { if (o.id) io.observe(o); });

  /* ── marcar lámina repasada, con memoria ── */
  var repasadas = (leer(CLAVE_REPASO) || '').split(',').filter(Boolean);
  d.querySelectorAll('[data-hecho]').forEach(function (b) {
    var id = b.getAttribute('data-hecho');
    pintarRepaso(b, id, repasadas.indexOf(id) > -1);
    b.onclick = function () {
      var i = repasadas.indexOf(id), ahora = i === -1;
      if (ahora) repasadas.push(id); else repasadas.splice(i, 1);
      guardar(CLAVE_REPASO, repasadas.join(','));
      pintarRepaso(b, id, ahora);
      b.classList.remove('recien'); void b.offsetWidth; b.classList.add('recien');
    };
    b.addEventListener('animationend', function () { b.classList.remove('recien'); });
  });
  function pintarRepaso(b, id, activo) {
    b.setAttribute('aria-pressed', String(activo));
    b.textContent = activo ? '✓ Repasada' : '✓ Marcar repasada';
    var art = d.getElementById(id); if (art) art.classList.toggle('repasada', activo);
    var li = d.querySelector('.toc li[data-lam="' + id + '"] > a');
    if (li) {
      var m = li.querySelector('.hecho');
      if (activo && !m) { m = d.createElement('span'); m.className = 'hecho'; m.textContent = '✓'; li.appendChild(m); }
      else if (!activo && m) m.remove();
    }
  }

  /* ── abrir o cerrar todas las respuestas de un bloque ── */
  d.querySelectorAll('.btn-todas').forEach(function (b) {
    b.onclick = function () {
      var art = b.closest('article.plate') || d.body;
      var qs = [].slice.call(art.querySelectorAll('details.q'));
      var abrir = qs.some(function (x) { return !x.open; });
      /* veintitrés alturas animándose a la vez trepidan: en bloque, sin animación */
      art.classList.add('a-granel');
      qs.forEach(function (x) { x.open = abrir; });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { art.classList.remove('a-granel'); });
      });
      b.textContent = abrir ? 'Cerrar todas' : 'Abrir todas';
    };
  });

  /* ── buscador: títulos primero, cuerpo después ── */
  var indice = [];
  d.querySelectorAll('article.plate').forEach(function (art) {
    var lam = art.querySelector('.tab span').textContent.trim();
    indice.push({ id: art.id, via: lam, txt: art.querySelector('h1').textContent.trim(), el: art });
    art.querySelectorAll('h2[id]').forEach(function (h) {
      var cuerpo = '', nodo = h.nextElementSibling;
      while (nodo && nodo.tagName !== 'H2') { cuerpo += ' ' + nodo.textContent; nodo = nodo.nextElementSibling; }
      indice.push({ id: h.id, via: lam, txt: h.textContent.replace(/^\s*\d+\s*/, '').trim(),
                    cuerpo: cuerpo.replace(/\s+/g, ' ').trim(), el: h });
    });
    art.querySelectorAll('details.q > summary').forEach(function (s) {
      if (!s.parentNode.id) s.parentNode.id = 'p-' + Math.random().toString(36).slice(2, 8);
      indice.push({ id: s.parentNode.id, via: lam + ' · pregunta', txt: s.textContent.trim(),
                    el: s.parentNode, q: true });
    });
    art.querySelectorAll('.caso').forEach(function (c) {
      indice.push({ id: c.id || art.id, via: lam + ' · caso',
                    txt: c.querySelector('.rot').textContent.trim() + ' — ' +
                         c.querySelector('.enunciado').textContent.trim().slice(0, 90), el: c });
    });
  });

  var q = d.getElementById('q'), res = d.getElementById('res'), sel = -1, hits = [];
  function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function buscar() {
    var t = norm(q.value.trim());
    if (t.length < 2) { res.classList.remove('abierto'); res.innerHTML = ''; return; }
    var enTitulo = indice.filter(function (i) { return norm(i.txt).indexOf(t) > -1; });
    var enCuerpo = indice.filter(function (i) {
      return i.cuerpo && norm(i.txt).indexOf(t) === -1 && norm(i.cuerpo).indexOf(t) > -1; });
    hits = enTitulo.concat(enCuerpo).slice(0, 14);
    if (!hits.length) {
      res.innerHTML = '<li class="vacio">Sin resultados para «' + q.value + '»</li>';
      res.classList.add('abierto'); return;
    }
    res.innerHTML = hits.map(function (h, n) {
      var i = norm(h.txt).indexOf(t), et, extra = '';
      if (i > -1) {
        et = h.txt.slice(0, i) + '<mark>' + h.txt.slice(i, i + t.length) + '</mark>' + h.txt.slice(i + t.length);
      } else {
        et = h.txt;
        var j = norm(h.cuerpo).indexOf(t), ini = Math.max(0, j - 42);
        extra = '<span class="frag">' + (ini > 0 ? '…' : '') + h.cuerpo.slice(ini, j) +
                '<mark>' + h.cuerpo.slice(j, j + t.length) + '</mark>' +
                h.cuerpo.slice(j + t.length, j + t.length + 58) + '…</span>';
      }
      return '<li><a href="#' + h.id + '" data-n="' + n + '"><span class="via">' + h.via + '</span>' + et + extra + '</a></li>';
    }).join('');
    res.classList.add('abierto'); sel = -1;
    res.querySelectorAll('a').forEach(function (a, n) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); irA(hits[n]); });
    });
  }
  function irA(h) {
    if (h.q) h.el.open = true;
    res.classList.remove('abierto');
    if (innerWidth < 1024) cerrarMovil();
    h.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { senalar(h.el); }, 90);
  }
  if (q) {
    q.addEventListener('input', buscar);
    q.addEventListener('keydown', function (e) {
      var as = res.querySelectorAll('a');
      if (e.key === 'Escape') { q.value = ''; res.classList.remove('abierto'); q.blur(); }
      else if (e.key === 'ArrowDown' && as.length) { e.preventDefault(); sel = Math.min(sel + 1, as.length - 1); pinta(as); }
      else if (e.key === 'ArrowUp' && as.length) { e.preventDefault(); sel = Math.max(sel - 1, 0); pinta(as); }
      else if (e.key === 'Enter' && hits.length) { e.preventDefault(); irA(hits[sel < 0 ? 0 : sel]); }
    });
    function pinta(as) {
      as.forEach(function (a, n) { a.classList.toggle('sel', n === sel);
        if (n === sel) a.scrollIntoView({ block: 'nearest' }); });
    }
    d.addEventListener('click', function (e) {
      if (!e.target.closest('.buscador')) res.classList.remove('abierto'); });
    d.addEventListener('keydown', function (e) {
      var esCampo = /input|textarea/i.test(d.activeElement.tagName);
      if (e.key === '/' && !esCampo) { e.preventDefault(); q.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); q.focus(); }
    });
  }

  /* ── PDF: abre las respuestas, imprime con el tema activo, restaura ── */
  var bpdf = d.getElementById('pdf');
  if (bpdf) bpdf.onclick = function () {
    var cerradas = [].slice.call(d.querySelectorAll('details.q')).filter(function (x) { return !x.open; });
    body.classList.add('a-granel');          /* nada a medio animar en la captura */
    cerradas.forEach(function (x) { x.open = true; });
    function restaurar() { cerradas.forEach(function (x) { x.open = false; });
      body.classList.remove('a-granel');
      removeEventListener('afterprint', restaurar); }
    addEventListener('afterprint', restaurar);
    print();
  };
})();
