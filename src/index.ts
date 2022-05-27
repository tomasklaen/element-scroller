const {max, min, abs} = Math;
const clamp = (bottom: number, value: number, top: number) => max(bottom, min(top, value));
const isWithin = (min: number, value: number, max: number) => value >= min && value <= max;

/**
 * Some operations are tied to per-frame time so we need to standardize it and
 * adjust for environments with different FPS.
 */
const STANDARD_FRAME_TIME = 1000 / 60;

/**
 * Detect lowest frame time so that it can be used in first animation frame
 * where we are unable to retrieve delta since last one. Due to fingerprinting
 * circumventions, both `Date.now()` and `performance.now()` can be rounded to
 * a whooping 100ms, which makes them useless, and us unable to determine start
 * of any animation...
 */
let minFrameTime = STANDARD_FRAME_TIME;
{
	let frames = 100;
	let lastFrameTime = -100;
	const frameTimeLoop = (time: number) => {
		const frameTime = time - lastFrameTime;
		if (frameTime < minFrameTime) minFrameTime = frameTime;
		lastFrameTime = time;
		if (frames-- > 0) requestAnimationFrame(frameTimeLoop);
	};
	requestAnimationFrame(frameTimeLoop);
}

/**
 * Keep track of the last global wheel event time so that we don't take over
 * wheel scrolling that was initiated outside our scroller.
 */
let lastGlobalWheel = 0;
let ignoreEvent: Event | null = null;
window.addEventListener('wheel', (event) => {
	if (event !== ignoreEvent) lastGlobalWheel = Date.now();
});

export interface Options {
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

export interface Position {
	left: number;
	top: number;
}

export interface ScrollLength {
	width: number;
	height: number;
}

export type ScrollOptions = Partial<Position> & {friction?: number};

export interface Scroller {
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

/**
 * Velocity vector is in pixels, not a fraction.
 */
type Velocity = [X, Y];
type X = number;
type Y = number;

/**
 * Interface to replace native smooth scrolling on an element.
 */
export function makeScroller(
	element: HTMLElement,
	{friction: frictionOption, handleWheel: doHandleWheel, flipWheel, wheelFriction}: Partial<Options> = {}
): Scroller {
	const self = {
		element,
		friction: frictionOption ?? 0.2,
		flipWheel: !!flipWheel,
		wheelFriction: wheelFriction ?? 0.25,
		scrollTo,
		scrollBy,
		glide,
		stop,
		dispose,
		disposed: false,
	};

	// Animation variables
	let friction = self.friction;
	let currentPosition = getPosition();
	let scrolling: Velocity | null = null;
	let gliding: Velocity | null = null;
	let frameId: number | null = null;
	let lastFrameTime: number | null;

	// Bind events
	if (doHandleWheel) element.addEventListener('wheel', handleWheel);
	element.addEventListener('scroll', handleScroll, {passive: true});

	function getPosition(): Position {
		return {left: element.scrollLeft, top: element.scrollTop};
	}

	function getScrollLength(): ScrollLength {
		return {
			width: element.scrollWidth - element.clientWidth,
			height: element.scrollHeight - element.clientHeight,
		};
	}

	function setPosition(position: Position) {
		currentPosition = position;
		element.scrollLeft = position.left;
		element.scrollTop = position.top;
	}

	function render(time: number) {
		if (self.disposed) return;

		const timeDelta = lastFrameTime != null ? time - lastFrameTime : minFrameTime;
		const {left, top} = currentPosition;
		const {width, height} = getScrollLength();
		let leftBy = 0;
		let topBy = 0;

		// Scrolling
		if (scrolling) {
			const standardFrameTimeDeviation = timeDelta / STANDARD_FRAME_TIME;
			const adjustedFriction = clamp(0, friction * standardFrameTimeDeviation, 1);
			const [x, y] = scrolling;
			let xDelta = x * adjustedFriction;
			let yDelta = y * adjustedFriction;

			scrolling[0] = abs(xDelta) < 0.2 || !isWithin(0, left + xDelta, width) ? 0 : x - xDelta;
			scrolling[1] = abs(yDelta) < 0.2 || !isWithin(0, top + yDelta, height) ? 0 : y - yDelta;
			if (scrolling[0] === 0 && scrolling[1] === 0) scrolling = null;

			leftBy += xDelta;
			topBy += yDelta;
		}

		// Gliding
		if (gliding) {
			let [x, y] = gliding;
			const secondFraction = timeDelta / 1000;
			leftBy += x * secondFraction;
			topBy += y * secondFraction;
		}

		setPosition({left: clamp(0, left + leftBy, width), top: clamp(0, top + topBy, height)});

		if (gliding || scrolling) {
			lastFrameTime = time;
			frameId = null;
			requestRender();
		} else {
			lastFrameTime = frameId = null;
		}
	}

	function requestRender() {
		if (!frameId) frameId = requestAnimationFrame(render);
	}

	/**
	 * Scroll to a specific coordinates.
	 *
	 * You can use `Infinity` to scroll to the end.
	 */
	function scrollTo({left, top, ...rest}: Partial<Position> & {friction?: number} = {}) {
		const {width, height} = getScrollLength();
		scrollBy({
			...rest,
			left: left == null ? 0 : clamp(0, left, width) - (currentPosition.left + (scrolling?.[0] || 0)),
			top: top == null ? 0 : clamp(0, top, height) - (currentPosition.top + (scrolling?.[1] || 0)),
		});
	}

	/**
	 * Scroll by amount of pixels.
	 */
	function scrollBy({left = 0, top = 0, ...rest}: Partial<Position> & {friction?: number} = {}) {
		friction = rest.friction || self.friction;
		scrolling = [(scrolling?.[0] || 0) + left, (scrolling?.[1] || 0) + top];
		requestRender();
	}

	/**
	 * Continuously scroll element.
	 */
	function glide({
		top,
		left,
	}: {
		/**
		 * Vertical speed in pixels per second. Use negative number to scroll back.
		 */
		top?: number;
		/**
		 * Horizontal speed in pixels per second. Use negative number to scroll back.
		 */
		left?: number;
	}) {
		gliding = [left || 0, top || 0];
		requestRender();
	}

	function stop() {
		if (frameId != null) cancelAnimationFrame(frameId);
		frameId = lastFrameTime = gliding = scrolling = null;
	}

	function handleWheel(event: WheelEvent) {
		// Ignore wheel events that are a part of a series of events that
		// started outside this element.
		if (Date.now() - lastGlobalWheel < 300) return;

		// Prevent tracking this event as last global wheel
		ignoreEvent = event;

		event.preventDefault();
		scrollBy(
			self.flipWheel
				? {left: event.deltaY, top: event.deltaX, friction: self.wheelFriction}
				: {left: event.deltaX, top: event.deltaY, friction: self.wheelFriction}
		);
	}

	/**
	 * Updates current position changed by scrolls that happened outside our
	 * scroller.
	 */
	function handleScroll() {
		if (!frameId) currentPosition = getPosition();
	}

	function dispose() {
		stop();
		self.disposed = true;
		element.removeEventListener('wheel', handleWheel);
		element.removeEventListener('scroll', handleScroll);
		if (frameId) cancelAnimationFrame(frameId);
	}

	return self;
}
