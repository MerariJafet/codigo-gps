<div align="center">

# 🌐 CÓDIGO GPS

### Navega cualquier código como un holograma — y deja que te *enseñe*

[![CI](https://github.com/MerariJafet/codigo-gps/actions/workflows/ci.yml/badge.svg)](https://github.com/MerariJafet/codigo-gps/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)

**Apúntalo a cualquier repo → obtén un mapa 3D interactivo de sus módulos, dependencias y problemas, con un mentor integrado que te explica todo en lenguaje claro.**

🇺🇸 [Read in English](README.md) · 🤖 [Guía para agentes IA](AGENTS.md) · 🏗️ [Arquitectura](docs/ARCHITECTURE.md)

![Holograma de CÓDIGO GPS con regiones por módulo](docs/screenshots/hologram_regions.png)

</div>

---

## ¿Por qué?

Los árboles de archivos mienten. La estructura *real* de un proyecto es quién-importa-a-quién, qué módulos están enredados entre sí, dónde viven los archivos-Dios escondidos, y qué línea guarda silenciosamente un secreto hardcodeado. CÓDIGO GPS dibuja todo eso como un holograma explorable — **y luego te lo explica como lo haría un ingeniero senior**.

## ✨ Qué hace

| | Función | Descripción |
|---|---------|-------------|
| 🫧 | **Regiones por módulo** | Los archivos se agrupan en "nebulosas" de color por módulo lógico, con etiquetas 3D. Los bloques de tu sistema, de un vistazo. |
| 🎨 | **Taxonomía de conexiones** | Cada línea de dependencia tiene color según su significado (ver [cómo leer el mapa](#-cómo-leer-el-mapa)). |
| 🔮 | **Puentes HTTP** | Detecta rutas de FastAPI y las empareja con llamadas `fetch`/`axios` — los enlaces frontend↔backend aparecen aunque no haya imports. |
| 🛡️ | **Motor analista** | Análisis estático: dependencias circulares, archivos Dios, huérfanos, archivos gigantes, módulos entrelazados, secretos hardcodeados, `eval`/`exec`, patrones de inyección SQL, `shell=True`, pickle/yaml inseguros, hashes débiles, XSS, CORS abierto y más. |
| 🎓 | **Modo Maestro** | Cada hallazgo trae *qué encontré / por qué importa / cómo arreglarlo* — enseña, no solo señala. |
| 🤖 | **Listo para agentes IA** | Un clic copia un prompt completo y autocontenido para que Claude Code (o cualquier agente) verifique, corrija y pruebe el hallazgo por su cuenta. |
| 📊 | **Dashboard** | Salud del proyecto (A–F), dona de lenguajes, distribución de complejidad, tamaño por módulo, archivos más conectados. |
| 🔍 | **Modo Zoom** | Clic en un archivo → desaparece todo excepto su cadena de conexiones (2 niveles). |
| ✋ | **Modo Mover** | Agarra un módulo completo (su nebulosa) y arrástralo para despejar el mapa. |
| 🚶 | **Modo Aprendizaje** | Tour guiado paso a paso: la cámara vuela a cada módulo mientras tarjetas explican qué es y qué archivos importan. |
| 🐘 | **Sin límite de tamaño** | El análisis corre del lado del servidor contra tu disco — un repo de 36 GB / 14,500 archivos se mapea en ~9 segundos. |

## 🚀 Arranque rápido

**Requisitos:** Python 3.12+, Node 20+.

```bash
git clone https://github.com/MerariJafet/codigo-gps.git
cd codigo-gps
./scripts/start.sh        # instala todo y levanta ambos servicios
```

Abre **http://localhost:3000**, elige una carpeta de proyecto con el explorador (o escribe su ruta), pulsa **INITIALIZE RUN** — listo.

<details>
<summary><b>Instalación manual</b></summary>

```bash
# Backend (FastAPI en :8000)
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python -m uvicorn backend.server.main:app --port 8000

# Frontend (Next.js en :3000) — en otra terminal
cd frontend
npm install
npm run dev
```
</details>

<details>
<summary><b>Docker</b></summary>

```bash
docker-compose up --build
# frontend: http://localhost:3000 · backend: http://localhost:8001
```
Nota: con Docker el backend solo puede navegar rutas montadas en el contenedor (el propio repo se monta en `/project`). Para analizar cualquier otra carpeta local, usa el botón **«Subir del navegador»** del explorador — lee la carpeta en tu navegador (filtrada: sin `node_modules`, solo código, con topes) y la envía como manifiesto.
</details>

## 🗺️ Las cuatro vistas

| Vista | Qué obtienes |
|-------|--------------|
| **Holograma** | El grafo 3D: archivos como esferas, dependencias como líneas, módulos como regiones de color. Orbita, haz zoom, pasa el cursor por una línea para ver *qué archivo conecta con cuál* y por qué. |
| **Dashboard** | La radiografía: medidor de salud, chips de severidad, lenguajes, complejidad, tamaño por módulo, top hubs — todo clickeable. |
| **Módulos** | Una tarjeta por módulo (cohesión %, archivos clave, lenguaje) más el **inspector de puentes**: clic en cualquier chip `A → B` para listar las conexiones archivo-a-archivo exactas que cruzan esa frontera. |
| **Maestro** | Todos los hallazgos, filtrables por categoría, cada uno expandible en sus tres bloques didácticos — con **Ver en el holograma** (ilumina el problema en rojo) y **Prompt para agente IA**. |

![Modo Aprendizaje](docs/screenshots/learning_tour.png)

## 🎨 Cómo leer el mapa

**Nodos** — una esfera por archivo. El tamaño crece con sus conexiones; los puntos de entrada brillan blanco; los hubs, amarillo; los huérfanos se ven atenuados.

**Líneas** — el color te dice qué tipo de dependencia es:

| Color | Significado |
|-------|-------------|
| 🔴 Roja | **Crítica / dañada** — ciclo, módulos entrelazados, o el hallazgo que resaltaste |
| 🟣 Violeta | **Puente HTTP** — código del frontend llamando a una ruta de la API |
| 🟡 Ámbar | **Puente entre módulos** — referencia que cruza fronteras de módulo |
| 🟢 Verde | **Esencial** — alimenta un archivo hub del que muchos dependen |
| 🎨 Color del módulo | **Interna** — import normal dentro de su módulo |

Pasa el cursor por cualquier línea para el tooltip `origen → destino · categoría`. La leyenda es arrastrable y colapsable.

## 🎮 Los modos en acción

| ✋ **Modo Mover** — agarra una nebulosa y reacomoda el mapa | 🔍 **Modo Zoom** — aísla un archivo + su cadena de 2 niveles |
|---|---|
| ![Modo Mover](docs/screenshots/move_mode.png) | ![Modo Zoom](docs/screenshots/zoom_mode.png) |

| 🎓 **Maestro** — enseña y redacta los secretos (`••••••••`) | 🧩 **Inspector de puentes** — cruces archivo-a-archivo exactos |
|---|---|
| ![Maestro](docs/screenshots/mentor_mode.png) | ![Inspector de puentes](docs/screenshots/bridge_inspector.png) |

## 🤖 Para agentes IA

- Cada hallazgo del **Maestro** tiene un botón *Prompt para agente IA* → copia un prompt autocontenido (hallazgo + evidencia `archivo:línea` + archivos afectados + instrucciones de verificar-y-reportar). Pégalo en Claude Code, Cursor o el agente que uses.
- El repo incluye [`AGENTS.md`](AGENTS.md) con el mapa completo orientado a máquinas: arquitectura, comandos, endpoints, convenciones y gotchas conocidos.

## 🧪 Desarrollo

```bash
# Tests del backend
.venv/bin/python -m pytest backend/tests -q

# Checks del frontend
cd frontend && npx tsc --noEmit && npm run lint && npm run build
```

## 📄 Licencia

[MIT](LICENSE).
