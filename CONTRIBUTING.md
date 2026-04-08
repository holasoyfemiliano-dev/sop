# Guía de Colaboración

## Regla de oro: nunca trabajar directamente en `main`

`main` es la rama de producción. Todo cambio entra a través de un Pull Request.

---

## Flujo de trabajo

### 1. Antes de empezar

```bash
git checkout main
git pull origin main
```

### 2. Crear tu rama

```bash
git checkout -b [tu-nombre]/[descripcion-corta]
```

Ejemplos:
```
femi/dashboard-redesign
carlos/api-schedule
ana/calendar-sync
```

### 3. Trabajar y commitear

Commits pequeños y frecuentes con mensajes descriptivos:

```bash
git add src/components/MiComponente.tsx
git commit -m "feat: descripción del cambio"
```

Prefijos de commits:
- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `refactor:` refactorización sin cambio de comportamiento
- `chore:` tareas de mantenimiento

### 4. Sincronizar con main antes de hacer PR

```bash
git fetch origin
git rebase origin/main
# Si hay conflictos, resolverlos y continuar:
# git rebase --continue
```

### 5. Publicar y crear Pull Request

```bash
git push origin [tu-nombre]/[descripcion-corta]
gh pr create --title "descripción" --body "qué hace y por qué"
```

---

## Archivos de alto riesgo de conflicto

Coordinar con el equipo antes de modificar:

| Archivo | Motivo |
|---|---|
| `src/app/page.tsx` | Dashboard principal |
| `src/lib/store.ts` | Estado global |
| `src/lib/types.ts` | Tipos compartidos |
| `src/app/globals.css` | Estilos globales |

---

## Protección de ramas

`main` tiene protección activada en GitHub:
- Se requiere Pull Request para mergear
- Se requiere al menos 1 aprobación
- No se permite push directo
