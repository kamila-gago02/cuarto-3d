# 🕹️ Mi Cuarto 3D — eng.student.room

Página web **3D interactiva** con estética *2000s + actualidad*: un cuarto de estudiante de ingeniería con pósters de rock de los 80-90, vinilos, repisas con plantas y libros, un escritorio esquinero y un montón de cacharros con los que puedes interactuar.

Construido con **[Three.js](https://threejs.org/)** usando solo **geometría primitiva** (nada de modelos externos), un único HTML/CSS/JS, sin build ni dependencias que instalar.

![estado](https://img.shields.io/badge/estado-escena_navegable-19f7c8) ![stack](https://img.shields.io/badge/three.js-r160-ff3cac)

---

## ✨ Qué hay en la escena

| Objeto | Interacción al hacer clic |
|---|---|
| 🖨️ **Impresora 3D** | Imprime una pieza capa a capa (el cabezal sube mientras la figura crece) |
| 🦾 **Brazo robótico** | Gira la base y articula sus eslabones en una secuencia |
| 🤖 **Robot móvil** | Abre una consola para escribirle frases/comandos (`hola`, `baila`, `girar`, `color rojo`, `ayuda`) |
| 💻 **Laptop + monitor + mouse + teclado** | La pantalla externa cambia de contenido |
| 🧱 **LEGO** | Las piezas dispersas se ensamblan solas en una torre (clic de nuevo para desarmar) |
| 🔥 **Estación de soldadura** | Protoboard, microcontrolador y sensores; al hacer clic sale humo del cautín |

Además: alfombra con estrella, ventana con cielo nocturno, luces neón y marquesina retro.

> El robot y la laptop tienen lógica base; su interacción avanzada se ampliará más adelante (marcado como "luego lo vemos").

---

## 🚀 Cómo ejecutarlo en local

Three.js se carga por CDN con un *import map*, así que **no hay que instalar nada**. Solo necesitas servirlo por HTTP (abrir el archivo directamente con `file://` no funciona con módulos ES).

### Opción A — Python (ya lo tienes en Windows normalmente)
```bash
python -m http.server 8000 --bind 127.0.0.1
```
Luego abre: http://127.0.0.1:8000

### Opción B — Node (si tienes npx)
```bash
npx serve .
```

### Opción C — Extensión "Live Server" de VS Code
Clic derecho en `index.html` → *Open with Live Server*.

---

## 🎮 Controles

- **Arrastrar** (clic izq): girar la cámara
- **Rueda**: zoom
- **Clic derecho + arrastrar**: desplazar
- **Clic** sobre los objetos que brillan: interactuar

---

## 📁 Estructura

```
cuarto-ingeniero-3d/
├── index.html   # estructura + overlays retro (HUD, consola, loader)
├── style.css    # estética 2000s (neón, scanlines, marquesina)
├── main.js      # toda la escena 3D y la lógica de interacción
├── README.md
├── LICENSE
└── .gitignore
```

Todo el 3D vive en `main.js`, organizado por secciones: renderer/cámara/luces, construcción del cuarto, y una función por cada objeto interactivo.

---

## 🛠️ Roadmap

- [ ] Lógica avanzada del robot (comandos que muevan el robot por el escritorio)
- [ ] Interacción real con la laptop (teclear y ver salida)
- [ ] Post-procesado (bloom) para el neón
- [ ] Sonidos (clic, impresora, soldadura)
- [ ] Modelos GLTF opcionales para detalle fino

---

## 📜 Licencia

MIT — ver [LICENSE](LICENSE).
