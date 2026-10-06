# Sistema de diseño móvil

## Estado actual

NativeWind 4 está conectado a Tailwind CSS 3 mediante Babel y Metro. `tailwind.config.js` declara:

```js
colors: {
  brand: '#258e8b';
}
```

La foundation incluye tokens semánticos mínimos en `src/theme`, su equivalencia para NativeWind y componentes base en `src/components/ui`.

La bienvenida usa fotografías, el logo horizontal de la web, fondo `#FFFFFF` y los tokens compartidos. Sus tres pantallas presentan la marca antes de `/inicio`; no representan todavía una feature de negocio funcional.

La web puede servir como referencia de jerarquía e identidad, no como layout para copiar. En particular, `#134e4c` existe en la web, pero está prohibido en el móvil.

## Principios

- interfaz clínica, clara, sobria y legible;
- mobile-first y compatible con Android/iOS;
- superficies sólidas, sin gradientes decorativos;
- jerarquía obtenida con espacio, tipografía y contraste;
- targets táctiles cómodos y estados visibles;
- componentes pequeños con variantes explícitas;
- accesibilidad y reduced motion desde el primer componente.

## Colores

### Valores obligatorios

- Fondo principal: `#FFFFFF`.
- Marca/secundario: `#258e8b`.
- Color prohibido: `#134e4c`.

### Tokens objetivo

Los nombres semánticos son preferibles a colores de escala usados directamente en pantallas:

```text
background      #FFFFFF
surface         #FFFFFF
surface-muted   gris claro neutro
brand           #258e8b
brand-pressed   variante accesible derivada, nunca #134e4c
text-primary    casi negro
text-secondary  gris con contraste suficiente
border          gris claro
success         verde semántico
warning         ámbar semántico
danger          rojo semántico
info            azul semántico
focus           #258e8b
```

Los valores no obligatorios deben validarse visualmente y por contraste antes de formalizarse. No conviertas colores puntuales de una pantalla en tokens globales.

## Spacing

Usa una escala consistente basada principalmente en múltiplos de 4:

```text
1: 4
2: 8
3: 12
4: 16
5: 20
6: 24
8: 32
10: 40
12: 48
```

- Padding horizontal usual de pantalla: 16–24 según ancho.
- Separa secciones por jerarquía, no con contenedores anidados innecesarios.
- Respeta safe areas y teclado.

## Typography

La tipografía oficial de la aplicación móvil es **Inter** (`@expo-google-fonts/inter`), precargada en el root layout mediante `useFonts` y `expo-splash-screen`. En Tailwind CSS se exponen las utilidades `font-sans`, `font-sans-medium`, `font-sans-semibold` y `font-sans-bold`.

Jerarquía objetivo:

- display/title: títulos de pantalla breves;
- heading: secciones y cards;
- body: contenido principal;
- label: formularios y controles;
- caption: metadata y ayuda.

No uses tamaños demasiado pequeños para información necesaria. Permite escalado de fuente y prueba textos largos en español.

## Radius y sombras

- Usa una escala corta de radius, por ejemplo 8, 12 y 16.
- Reserva formas totalmente redondas para icon buttons, avatares y badges apropiados.
- Prefiere borde sutil a sombras fuertes.
- Las sombras deben probarse en Android e iOS; no dependas solo de propiedades específicas de una plataforma.

## Iconografía

La iconografía del cliente móvil se basa de manera exclusiva en **`lucide-react-native`**:

- Prohibido el uso de caracteres tipográficos o flechas de texto (`→`, `←`, etc.).
- Importación directa obligatoria: importar siempre cada icono desde su ruta específica (ej. `import ArrowRight from 'lucide-react-native/icons/arrow-right'`), nunca desde el barrel general para evitar fallos de resolución en Metro y sobrepeso en el bundle.
- Los iconos no tienen un color fijo: se definen dinámicamente de acuerdo a la situación (superficie, variante del componente contenedor y jerarquía visual), consumiendo los tokens semánticos de `src/theme/colors.ts`.
- Tamaños estándar: 16 (compacto/tags), 20 (botones/listas/inputs) y 24 (navegación/acciones principales).
- `strokeWidth`: estándar en 2.
- Ocultar a lectores de pantalla cuando acompañen a un texto accesible.

## Componentes base objetivo

### Button

Variantes mínimas: primary, secondary, outline, ghost y destructive cuando exista una acción destructiva real.

Estados: default, pressed, focused, disabled y loading. El botón debe conservar su label durante loading cuando ayude a evitar cambios de ancho.

### Input

- label visible;
- placeholder no usado como único label;
- ayuda y error asociados;
- `aria`/accessibility props equivalentes;
- configuración de teclado y autofill adecuada;
- estado disabled y readonly distinguibles.

### Card

Una card agrupa contenido relacionado y no debe contener capas redundantes. Si es interactiva, toda el área debe tener semántica y estado pressed.

### Feedback

- loading: skeleton o indicador proporcional al tiempo esperado;
- empty: explicación y siguiente acción útil;
- error: mensaje claro y retry cuando sea seguro;
- success: confirmación breve;
- offline: estado persistente sin confundirlo con error del servidor.

## Imágenes de producto

- conserva aspect ratio;
- define placeholder y error state;
- evita cargar resoluciones innecesarias;
- proporciona descripción accesible cuando la imagen aporta información;
- no asumas que `next/image` o su configuración web son reutilizables.

## Accessibility

- targets táctiles de al menos 44 × 44 puntos cuando sea posible;
- contraste conforme a WCAG AA;
- labels accesibles para icon buttons;
- orden de foco predecible;
- no comunicar estado solo mediante color;
- soportar font scaling y screen readers;
- respetar reduced motion;
- anunciar errores y cambios importantes sin producir ruido excesivo.

## Responsive móvil

- prueba teléfonos pequeños, medianos y grandes;
- evita anchos fijos que provoquen clipping;
- usa `useWindowDimensions` solo cuando la composición realmente cambia;
- considera orientación únicamente si producto la aprueba; `app.json` está actualmente en portrait;
- `supportsTablet: true` existe, pero el soporte formal de tablet está pendiente.

## NativeWind

- usa tokens y clases semánticas mantenidas en configuración compartida;
- evita hexadecimales repetidos en pantallas;
- ordena clases con Prettier;
- no construyas nombres de clase Tailwind dinámicamente si el compilador no puede detectarlos;
- usa `style` para valores dinámicos que no encajan en clases estáticas;
- no copies clases DOM o breakpoints desktop de la web.

## Revisión visual mínima

Antes de cerrar una pantalla, revisa Android e iOS, safe area, teclado, scroll, textos largos, loading, empty, error, offline, contraste, font scaling y targets táctiles.
