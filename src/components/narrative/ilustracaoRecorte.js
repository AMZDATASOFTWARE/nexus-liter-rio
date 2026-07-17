// Aplica uma vinheta orgânica (bordas que esmaecem até transparente) numa imagem PNG em base64,
// pra que pareça um recorte artesanal — não um retângulo rígido — ao ser inserida no PDF (que
// respeita o canal alpha do PNG, deixando a cor da página aparecer por trás das bordas).
export function aplicarVinhetaOrganica(base64Png, formato = "organico") {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width, h = img.height;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const dado = ctx.getImageData(0, 0, w, h);
      const pix = dado.data;

      const cx = w / 2, cy = h / 2;
      // Lóbulos deslocados do centro, com raios distintos — quebra a simetria de uma vinheta
      // circular perfeita, dando um contorno mais orgânico/desenhado à mão.
      const lobulos =
        formato === "retangular_suave"
          ? [
              { x: cx, y: cy * 0.85, rx: w * 0.62, ry: h * 0.78 },
              { x: cx - w * 0.12, y: cy * 1.05, rx: w * 0.55, ry: h * 0.68 },
              { x: cx + w * 0.1, y: cy * 0.95, rx: w * 0.58, ry: h * 0.72 },
            ]
          : [
              { x: cx, y: cy, rx: w * 0.46, ry: h * 0.46 },
              { x: cx - w * 0.08, y: cy + h * 0.06, rx: w * 0.4, ry: h * 0.42 },
              { x: cx + w * 0.07, y: cy - h * 0.05, rx: w * 0.42, ry: h * 0.4 },
            ];

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let melhorAlpha = 0;
          for (const l of lobulos) {
            const dx = (x - l.x) / l.rx;
            const dy = (y - l.y) / l.ry;
            const d = Math.sqrt(dx * dx + dy * dy);
            // Núcleo sólido até 0.7 do raio do lóbulo, depois esmaece suavemente até 1.15
            const alpha = d <= 0.7 ? 1 : d >= 1.15 ? 0 : 1 - (d - 0.7) / 0.45;
            if (alpha > melhorAlpha) melhorAlpha = alpha;
          }
          const i = (y * w + x) * 4 + 3;
          pix[i] = Math.round(pix[i] * melhorAlpha);
        }
      }

      ctx.putImageData(dado, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Falha ao carregar imagem para aplicar vinheta"));
    img.src = base64Png;
  });
}
