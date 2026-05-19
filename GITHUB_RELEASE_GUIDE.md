# Guía de Lanzamiento en GitHub (Proyecto Público)

Este documento detalla los pasos recomendados para asegurar que el repositorio sea funcional, seguro y de alta calidad antes y después de hacerlo público.

## 1. Preparación del Repositorio

### Archivos de Configuración
- Asegúrate de que el archivo `.gitignore` incluya:
  - `node_modules/`
  - `.next/`
  - `output/` (donde se guardan los reportes locales)
  - `.env` y `.env.local`
  - Logs (`*.log`)

### Secretos y Seguridad
- **No incluyas secretos**: Se ha realizado un escaneo y no se detectaron llaves de API o contraseñas hardcodeadas. El sistema de sanitización del crawler ya filtra tokens y cookies de las URLs y respuestas.
- **SSRF Policy**: El proyecto ya cuenta con una política de protección contra SSRF en `src/lib/ssrf-policy.ts`. Asegúrate de no desactivarla en entornos de producción.

## 2. Configuración en GitHub

### GitHub Actions
- Se ha añadido un workflow de CI en `.github/workflows/ci.yml` que:
  - Instala dependencias.
  - Compila el servicio de crawling.
  - Ejecuta el linter.
  - Verifica que la aplicación de Next.js compile correctamente.

### Protección de Ramas
- Ve a `Settings > Branches` y añade una regla de protección para la rama `main`:
  - Requiere "Pull Request" antes de fusionar.
  - Requiere que los checks de "CI" pasen exitosamente.

### Dependabot
- Activa Dependabot para mantener las dependencias actualizadas y seguras (`Settings > Code security and analysis`).

## 3. Despliegue Local (Instrucciones para Usuarios)

Para que un usuario de GitHub pueda levantar el proyecto localmente:

1. **Clonar el repo**:
   ```bash
   git clone <tu-repo-url>
   cd webscope
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Compilar el crawler** (necesario para el primer inicio):
   ```bash
   npm run prebuild
   ```

4. **Instalar Playwright Chromium**:
   ```bash
   npx playwright install chromium
   ```

5. **Iniciar desarrollo**:
   ```bash
   npm run dev
   ```

## 4. Recomendaciones Finales

- **Licencia**: Asegúrate de añadir un archivo `LICENSE` (ej. MIT) si deseas que otros puedan usar o contribuir al código.
- **README**: El README actual es funcional, pero podrías añadir pantallazos de la interfaz para hacerlo más atractivo.
- **Discusiones**: Si el repo crece, activa "GitHub Discussions" para interactuar con la comunidad.
