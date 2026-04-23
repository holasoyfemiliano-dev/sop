# Guía de Colaboración

## Flujo de trabajo

Antes de empezar a trabajar siempre:

```bash
git pull origin main
```

Cada cambio va en su propia rama:

```bash
git checkout -b feat/nombre-del-cambio
# ... hacer cambios ...
git push origin feat/nombre-del-cambio
# Abrir Pull Request en GitHub
```

---

## División de trabajo

### Gio
| Archivo | Descripción |
|---|---|
| `src/app/page.tsx` | Dashboard principal |
| `src/app/goals/page.tsx` | Metas |
| `src/app/analytics/page.tsx` | Analytics |
| `src/components/RingProgress.tsx` | Componente de progreso |

### Femi
| Archivo | Descripción |
|---|---|
| `src/app/calendar/page.tsx` | Calendario |
| `src/app/tracker/page.tsx` | Tracker de hábitos/tiempo |
| `src/app/chat/page.tsx` | Chat con IA |
| `src/app/settings/page.tsx` | Configuración |
| `src/app/api/` | Rutas de API (gcal, schedule, chat) |

---

## Archivos compartidos — coordinar antes de tocar

Estos archivos los usan los dos. Avisar al otro antes de modificarlos:

- `src/lib/store.ts` — Estado global
- `src/lib/types.ts` — Tipos compartidos
- `src/components/Nav.tsx` — Navegación
- `src/app/layout.tsx` — Layout raíz
- `src/app/globals.css` — Estilos globales

---

## Regla de oro

> Si necesitas tocar un archivo del otro o uno compartido, avisa primero y coordinan quién lo hace.
