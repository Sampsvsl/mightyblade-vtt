// ═══════════════════════════════════════════════════════════════
//  mb-dice.js — Animação física de dados para Mesa Virtual
//
//  Os dados são arremessados de fora da tela, voam com arco,
//  quicam ao pousar e mostram a face correta com brilho.
//  Sem fundo — os dados flutuam direto sobre o jogo.
//
//  API:  DiceAnimator.roll(rolls, sides, author, onSettledCallback)
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var SIZE     = 80;   // px — tamanho do cubo
  var HALF     = SIZE / 2;
  var T_FLY    = 1900; // ms — duração do arremesso + pouso
  var T_SHOW   = 1300; // ms — tempo exibindo resultado após pousar
  var T_FADE   = 500;  // ms — fade-out final

  // ── Pontos por face ──
  var DOTS = {
    1: [[50,50]],
    2: [[72,28],[28,72]],
    3: [[72,28],[50,50],[28,72]],
    4: [[28,28],[72,28],[28,72],[72,72]],
    5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
    6: [[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]]
  };

  // ── Rotação final para cada face de d6 ──
  var FACE_ROT = {
    1: [  0,   0],
    2: [  0, -90],
    3: [ 90,   0],
    4: [-90,   0],
    5: [  0,  90],
    6: [  0, 180]
  };

  // ─────────────────────────────────────────────────────────────
  //  CSS base — injetado uma vez
  // ─────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    // Overlay transparente, sem fundo
    '#mb-dice-overlay{',
      'position:fixed;top:0;left:0;right:0;bottom:0;',
      'z-index:9800;pointer-events:none;}',

    // Mover: posição absoluta na tela
    '.mb-mv{position:absolute;will-change:transform;}',

    // Perspectiva aplicada no container de cada dado
    '.mb-persp{',
      'perspective:450px;',
      'position:relative;',
      'width:' + SIZE + 'px;height:' + SIZE + 'px;}',

    // Cubo 3D
    '.mb-cube{',
      'width:' + SIZE + 'px;height:' + SIZE + 'px;',
      'position:relative;transform-style:preserve-3d;',
      'will-change:transform;}',

    // Faces
    '.mb-face{',
      'position:absolute;',
      'width:' + SIZE + 'px;height:' + SIZE + 'px;',
      'background:linear-gradient(145deg,#f9f3e1 0%,#ede1c2 55%,#ddd1aa 100%);',
      'border-radius:13px;',
      'border:2px solid rgba(140,100,40,.3);',
      'box-shadow:',
        'inset 0 3px 8px rgba(255,255,255,.72),',
        'inset 0 -3px 7px rgba(100,70,20,.22);}',
    '.mb-face::after{content:"";position:absolute;inset:0;border-radius:11px;',
      'background:linear-gradient(135deg,rgba(255,255,255,.22) 0%,transparent 55%);}',

    // Posição das faces no cubo
    '.mb-f1{transform:translateZ('  + HALF + 'px);}',
    '.mb-f2{transform:rotateY( 90deg) translateZ(' + HALF + 'px);}',
    '.mb-f3{transform:rotateX(-90deg) translateZ(' + HALF + 'px);}',
    '.mb-f4{transform:rotateX( 90deg) translateZ(' + HALF + 'px);}',
    '.mb-f5{transform:rotateY(-90deg) translateZ(' + HALF + 'px);}',
    '.mb-f6{transform:rotateY(180deg) translateZ(' + HALF + 'px);}',

    // Pontos
    '.mb-dot{',
      'position:absolute;width:14px;height:14px;',
      'background:radial-gradient(circle at 38% 32%,#6b3010,#1a0808);',
      'border-radius:50%;transform:translate(-50%,-50%);',
      'box-shadow:0 1px 2px rgba(0,0,0,.4);}',

    // Sombra no chão
    '.mb-shadow{',
      'position:absolute;',
      'width:' + SIZE + 'px;height:12px;',
      'background:radial-gradient(ellipse,rgba(0,0,0,.45) 0%,transparent 72%);',
      'border-radius:50%;',
      'bottom:-14px;left:0;',
      'transform:scaleX(1.3);',
      'opacity:0;transition:opacity .25s;}',
    '.mb-mv.mb-land .mb-shadow{opacity:1;}',

    // Brilho ao pousar
    '.mb-glow{',
      'position:absolute;inset:-6px;border-radius:0;',   // d6: quadrado, sem arredondamento
      'border:2px solid transparent;pointer-events:none;',
      'transition:border-color .4s,box-shadow .45s;}',
    '.mb-mv--token .mb-glow{border-radius:50%;}',         // token: circular
    '.mb-mv.mb-settle .mb-glow{',
      'border-color:rgba(212,168,67,.9);',
      'box-shadow:',
        '0 0 18px rgba(212,168,67,.65),',
        '0 0 42px rgba(200,80,20,.35);}',

    // Token genérico (non-d6): círculo com o número
    '.mb-tok{',
      'width:' + SIZE + 'px;height:' + SIZE + 'px;',
      'border-radius:50%;',
      'background:radial-gradient(circle at 40% 36%,#2e1a08,#0c0503);',
      'border:3px solid rgba(200,113,42,.4);',
      'box-shadow:inset 0 2px 8px rgba(255,255,255,.06),0 4px 16px rgba(0,0,0,.6);',
      'display:flex;align-items:center;justify-content:center;}',
    '.mb-tok-num{',
      'font-family:"Cinzel Decorative",cursive;',
      'font-size:1.5rem;font-weight:700;',
      'color:rgba(200,150,60,.25);',
      'transition:color .35s,text-shadow .35s;}',
    '.mb-mv.mb-settle .mb-tok-num{',
      'color:#d4a843;',
      'text-shadow:0 0 16px rgba(212,168,67,.8),0 0 32px rgba(200,80,20,.3);}'
  ].join('');
  document.head.appendChild(style);

  // ─────────────────────────────────────────────────────────────
  //  Overlay
  // ─────────────────────────────────────────────────────────────
  var overlay = document.createElement('div');
  overlay.id = 'mb-dice-overlay';
  document.body.appendChild(overlay);

  // ─────────────────────────────────────────────────────────────
  //  Utilitários
  // ─────────────────────────────────────────────────────────────
  function r(min, max) { return min + Math.random() * (max - min); }

  function uid() {
    return Math.random().toString(36).substr(2, 8);
  }

  function injectKF(css) {
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
    return s;
  }

  function buildFace(n) {
    var face = document.createElement('div');
    face.className = 'mb-face mb-f' + n;
    (DOTS[n] || []).forEach(function(p) {
      var dot = document.createElement('div');
      dot.className = 'mb-dot';
      dot.style.left = p[0] + '%';
      dot.style.top  = p[1] + '%';
      face.appendChild(dot);
    });
    return face;
  }

  // ─────────────────────────────────────────────────────────────
  //  Calcula posições de pouso espalhadas na tela
  // ─────────────────────────────────────────────────────────────
  function landingPositions(count) {
    var vw  = window.innerWidth;
    var vh  = window.innerHeight;
    var cx  = vw / 2;
    var cy  = vh * 0.56;
    var sp  = Math.min(108, (vw * 0.65) / Math.max(count, 1));
    var pos = [];
    for (var i = 0; i < count; i++) {
      var lx = cx + (i - (count - 1) / 2) * sp - HALF;
      var ly = cy - HALF + r(-16, 16);
      pos.push({ x: lx, y: ly });
    }
    return pos;
  }

  // Posição inicial de cada dado (fora da tela)
  function startPos(i) {
    var vw = window.innerWidth;
    var t  = i % 3;
    if (t === 0) return { x: r(-130, vw * 0.15), y: r(-140, -90) };   // esquerda-topo
    if (t === 1) return { x: r(vw * 0.35, vw * 0.65), y: r(-160, -90) }; // centro-topo
    return { x: r(vw * 0.85, vw + 100), y: r(-140, -90) };            // direita-topo
  }

  // ─────────────────────────────────────────────────────────────
  //  API pública
  // ─────────────────────────────────────────────────────────────
  var hideTimer        = null;
  var settleTimer      = null;   // callback "resultado no chat"
  var cleanupSubTimer  = null;   // limpeza final após fade-out
  var cleanupFns       = [];

  window.DiceAnimator = {

    roll: function (rolls, sides, author, onSettled) {
      if (!rolls || rolls.length === 0) {
        if (onSettled) onSettled();
        return;
      }

      // Cancela TUDO da animação anterior
      clearTimeout(hideTimer);
      clearTimeout(settleTimer);
      clearTimeout(cleanupSubTimer);
      cleanupFns.forEach(function(fn) { fn(); });
      cleanupFns = [];
      overlay.innerHTML = '';

      var isD6   = (sides === 6);
      var lands  = landingPositions(rolls.length);
      var movers = [];

      rolls.forEach(function (result, i) {
        var id    = uid();
        var delay = i * 90;
        var s     = startPos(i);
        var land  = lands[i];
        var bH    = r(14, 26); // altura do quique

        // ── Keyframes do mover (posição + escala) ──
        var mvName = 'mbmv' + id;
        var mx  = (s.x + land.x) / 2;
        var my  = Math.min(s.y, land.y) - r(100, 220);
        var mvKF = '@keyframes ' + mvName + '{' +
          '0%  {transform:translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px) scale(.65);}' +
          '30% {transform:translate(' + mx.toFixed(1) + 'px,' + my.toFixed(1) + 'px) scale(1.06);}' +
          '68% {transform:translate(' + land.x.toFixed(1) + 'px,' + (land.y + bH).toFixed(1) + 'px) scale(1);}' +
          '78% {transform:translate(' + land.x.toFixed(1) + 'px,' + (land.y - bH * .55).toFixed(1) + 'px) scale(1.05,.93);}' +
          '86% {transform:translate(' + land.x.toFixed(1) + 'px,' + (land.y + bH * .2).toFixed(1) + 'px) scale(.97,1.05);}' +
          '93% {transform:translate(' + land.x.toFixed(1) + 'px,' + (land.y - bH * .08).toFixed(1) + 'px) scale(1.01,.99);}' +
          '100%{transform:translate(' + land.x.toFixed(1) + 'px,' + land.y.toFixed(1) + 'px) scale(1);}' +
          '}';

        // ── Keyframes de rotação ──
        var spName = 'mbsp' + id;
        var spKF;

        if (isD6) {
          var fr = FACE_ROT[result] || [0, 0];
          // Dado gira no ar e já chega na face certa ao pousar (68%)
          // De 68% em diante fica travado no número — sem giro no pouso
          spKF = '@keyframes ' + spName + '{' +
            '0%  {transform:rotateX(0deg) rotateY(0deg) rotateZ(' + r(-25,25).toFixed(0) + 'deg);}' +
            '25% {transform:rotateX(' + r(-360,-540).toFixed(0) + 'deg) rotateY(' + r(360,540).toFixed(0) + 'deg) rotateZ(' + r(-15,15).toFixed(0) + 'deg);}' +
            '50% {transform:rotateX(' + r(270,450).toFixed(0) + 'deg) rotateY(' + r(-270,-450).toFixed(0) + 'deg) rotateZ(' + r(-6,6).toFixed(0) + 'deg);}' +
            '68% {transform:rotateX(' + fr[0] + 'deg) rotateY(' + fr[1] + 'deg) rotateZ(0deg);}' +
            '100%{transform:rotateX(' + fr[0] + 'deg) rotateY(' + fr[1] + 'deg) rotateZ(0deg);}' +
            '}';
        } else {
          var sp = r(3,5) * 360;
          // Token gira no ar e trava ao pousar (68%)
          spKF = '@keyframes ' + spName + '{' +
            '0%  {transform:rotateY(0deg) rotateZ(' + r(-20,20).toFixed(0) + 'deg);}' +
            '68% {transform:rotateY(' + sp.toFixed(0) + 'deg) rotateZ(0deg);}' +
            '100%{transform:rotateY(' + sp.toFixed(0) + 'deg) rotateZ(0deg);}' +
            '}';
        }

        // Injeta keyframes
        var kfS = injectKF(mvKF + spKF);
        cleanupFns.push(function() { if (kfS.parentNode) kfS.parentNode.removeChild(kfS); });

        // ── Monta elementos ──
        var mover = document.createElement('div');
        mover.className = 'mb-mv ' + (isD6 ? 'mb-mv--cube' : 'mb-mv--token');
        mover.style.animation = mvName + ' ' + T_FLY + 'ms cubic-bezier(.28,.46,.4,.94) ' + delay + 'ms both';

        var persp = document.createElement('div');
        persp.className = 'mb-persp';

        var glow = document.createElement('div');
        glow.className = 'mb-glow';
        persp.appendChild(glow);

        var shadow = document.createElement('div');
        shadow.className = 'mb-shadow';
        persp.appendChild(shadow);

        if (isD6) {
          var cube = document.createElement('div');
          cube.className = 'mb-cube';
          cube.style.animation = spName + ' ' + T_FLY + 'ms cubic-bezier(.5,.05,.5,.95) ' + delay + 'ms both';
          for (var f = 1; f <= 6; f++) cube.appendChild(buildFace(f));
          persp.appendChild(cube);
        } else {
          var tok = document.createElement('div');
          tok.className = 'mb-tok';
          tok.style.animation = spName + ' ' + T_FLY + 'ms cubic-bezier(.4,0,.2,1) ' + delay + 'ms both';
          var num = document.createElement('div');
          num.className = 'mb-tok-num';
          num.textContent = result;
          tok.appendChild(num);
          persp.appendChild(tok);
        }

        mover.appendChild(persp);
        overlay.appendChild(mover);
        movers.push(mover);

        // Sombra aparece ao se aproximar do chão
        var landDelay = delay + T_FLY * 0.65;
        setTimeout(function(m) { m.classList.add('mb-land'); }, landDelay, mover);

        // Brilho ao pousar
        setTimeout(function(m) { m.classList.add('mb-settle'); }, delay + T_FLY, mover);
      });

      // ── Callback: resultado no chat (quando último dado pousa) ──
      var lastDelay = (rolls.length - 1) * 90;
      settleTimer = setTimeout(function () {
        if (onSettled) onSettled();
      }, lastDelay + T_FLY + 80);

      // ── Fade-out dos dados após exibição ──
      hideTimer = setTimeout(function () {
        movers.forEach(function (m) {
          m.style.transition = 'opacity ' + T_FADE + 'ms ease';
          m.style.opacity    = '0';
        });
        cleanupSubTimer = setTimeout(function () {
          overlay.innerHTML = '';
          cleanupFns.forEach(function(fn) { fn(); });
          cleanupFns = [];
        }, T_FADE + 100);
      }, lastDelay + T_FLY + T_SHOW);
    }
  };

})();
