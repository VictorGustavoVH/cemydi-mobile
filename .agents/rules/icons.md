# Regla: Iconografía Oficial con Lucide React Native

## 1. Biblioteca única y obligatoria
- La iconografía del proyecto móvil CEMYDI debe utilizar **únicamente `lucide-react-native`**.
- Está prohibido el uso de caracteres de texto como flechas o símbolos (`→`, `←`, `✓`, `✕`, etc.) para simular iconos.
- No se deben agregar otras bibliotecas de iconos (como `@expo/vector-icons`, FontAwesome o MaterialIcons).
- **Importación directa obligatoria**: Importa siempre los iconos por su ruta individual en kebab-case (`import ArrowRight from 'lucide-react-native/icons/arrow-right';`) en lugar de usar la importación barrel (`import { ArrowRight } from 'lucide-react-native';`), para evitar fallos de resolución en Metro con módulos `.mjs` y sobrecargar el bundle con más de 1500 iconos.

## 2. Color dinámico y adaptativo según la situación
- Los iconos **no tienen un color fijo**: deben adaptarse al contexto, variante de componente y superficie donde se encuentren:
  - En botones primarios (`AppButton` variante `primary`): color blanco/`colors.onBrand`.
  - En botones secundarios o de superficie tenue: color del texto principal (`colors.textPrimary`).
  - En enlaces, botones `ghost` u `outline`: color de marca (`colors.brand`).
  - En acciones destructivas o de alerta: color de peligro (`colors.danger`).
  - En metadatos o estados secundarios: color de texto secundario (`colors.textSecondary`).
- Siempre utilizar los tokens semánticos definidos en `src/theme/colors.ts` o clases equivalentes de Tailwind para colorear los iconos.

## 3. Dimensiones y estilo consistentes
- Tamaños estándar:
  - `16` (sm): metadatos, tags, captions o botones compactos.
  - `20` (md): interior de botones estándar, inputs y listas.
  - `24` (lg): acciones principales, navegación de cabecera o botones destacados.
- `strokeWidth`: mantener un grosor de trazo consistente de `2` (o `2.25` para iconos de menor escala), salvo especificación contraria.

## 4. Accesibilidad
- Cuando un icono sea meramente decorativo y acompañe una etiqueta de texto legible, debe omitirse de la lectura de accesibilidad.
- Cuando un icono funcione como botón o control interactivo solitario, debe contar obligatoriamente con `accessibilityRole="button"`, `accessibilityLabel` descriptivo y un área táctil mínima de 44x44 pt.
