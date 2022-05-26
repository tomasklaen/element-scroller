# element-scroller

Improved and extended interface for smooth DOM element scrolling.

Native scrolling APIs are horrendous when using `behavior: 'smooth'` because when `scrollBy` is called while previous one is still animating, it starts animating from the current position, not from the target of the ongoing animation. This effectively eats up all but the last call when this method is called shortly one after another, resulting in unresponsive, and downright broken scrolling.

Features:

-   Tiny, [<2KB min, ~1KB gz](https://bundlephobia.com/package/element-scroller).
-   Configurable scrolling friction coefficient.
-   Can take over native mouse wheel (to match scrolling friction).
-   Ability to flip wheel direction: vertical scrolling will scroll element horizontally.
-   Scroll gliding, useful for implementing "scroll while cursor hovers edge".
-   Scroll to/by and gliding can all be called while others are still active, everything works together seamlessly.

## Install

```
npm install element-scroller
```

## Usage

```ts
import {makeScroller} from 'element-scroller';

const container = document.getElementById('container');
const scroller = makeScroller(container);

scroller.scrollBy({left: 100, top: 200, friction: 0.2});
scroller.scrollTo({top: 500});
scroller.glide({top: -100}); // up
scroller.stop(); // stop gliding or any other ongoing scrolling
scroller.dispose(); // unbinds everything and makes all methods impotent
```

## API

### makeScroller

```ts
function makeScroller(element: HTMLElement, options: Options): ElementScroller;
```

#### `element`

Any DOM HTML Element.

#### `options`

```ts
interface Options {
	/**
	 * Coefficient of friction between 0 and 1, where 0 means infinite, and 1
	 * means instant animations. Default: 0.2
	 */
	friction: number;
	/**
	 * Wether to take over wheel scrolling.
	 */
	handleWheel: boolean;
	/**
	 * Wether vertical scrolls should scroll the element horizontally, and vice
	 * versa.
	 */
	flipWheel: boolean;
	/**
	 * Coefficient of friction to use when wheel scrolling. Default: 0.3
	 */
	wheelFriction: number;
}
```

#### Return

See [Scroller](#scroller) below.

### Scroller

```ts
interface Scroller {
	readonly element: HTMLElement;
	flipWheel: boolean;
	friction: number;
	wheelFriction: number;
	scrollTo(options: ScrollOptions): void;
	scrollBy(options: ScrollOptions): void;
	glide(options: Partial<Position>): void;
	stop(): void;
	dispose(): void;
	readonly disposed: boolean;
}

interface Position {
	left: number;
	top: number;
}

type ScrollOptions = Partial<Position> & {friction?: number};
```

#### element

Type: `HTMLElement` **readonly**

The DOM element this scroller is working with.

#### flipWheel

Type: `boolean`

Controls wether wheel scrolling (if `handleWHeel` was requested) should be flipped.

#### friction

Type: `number`

Default friction to use for `scrollBy/scrollTo` when one is not passed.

#### wheelFriction

Type: `number`

Friction to use when wheel scrolling.

#### scrollTo

Type: `scrollTo(options: ScrollOptions): void`

Scroll element to a specific coordinates.

##### `options`

```ts
interface ScrollOptions {
	left?: number;
	top?: number;
	friction?: number;
}
```

You can use `Infinity` for `left` and `top` to scroll to the end.

#### scrollBy

Type: `scrollBy(options: ScrollOptions): void`

Scroll element by an amount of pixels.

##### `options`

```ts
interface ScrollOptions {
	left?: number;
	top?: number;
	friction?: number;
}
```

#### glide

Type: `glide(options: GlideOptions): void`

Scroll element continuously in linear motion by configured number of pixels per second until `stop()` is called.

##### `options`

```ts
interface GlideOptions {
	left?: number;
	top?: number;
}
```

Use negative numbers to scroll back.

#### stop

Type: `stop(): void`

Stops gliding or any other ongoing scrolling.

#### dispose

Type: `dispose(): void`

Stops any ongoing animation, unbinds everything, and makes all methods impotent.

#### disposed

Type: `boolean` **readonly**

Wether this scroller was already disposed.
