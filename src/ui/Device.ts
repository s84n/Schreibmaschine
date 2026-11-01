/**
 * Smartphone: Touch und kürzere Bildschirmseite unter 600 CSS-Pixeln. Tablets liegen darüber.
 * Dort lässt die Bildschirmtastatur zum Tippen zu wenig Platz, deshalb tippt die Maschine ab.
 */
export const isPhone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
