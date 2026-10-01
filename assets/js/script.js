/* ========================================
   NORD HOME — SCRIPT
   Vanilla JS, без библиотек.
   Вся логика разделена на независимые модули,
   каждый из которых корректно завершает работу,
   если его разметки на странице нет.
   ======================================== */

(function () {
    'use strict';

    /* ========================================
       UTILITY
       ======================================== */

    var STORAGE_CART = 'nordHomeCart';
    var STORAGE_FAVORITES = 'nordHomeFavorites';
    var HERO_AUTOPLAY_DELAY = 6000;
    var SWIPE_THRESHOLD = 50;

    var reduceMotionQuery = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    function prefersReducedMotion() {
        return Boolean(reduceMotionQuery && reduceMotionQuery.matches);
    }

    function qs(selector, scope) {
        return (scope || document).querySelector(selector);
    }

    function qsa(selector, scope) {
        return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function debounce(fn, delay) {
        var timer = null;

        return function () {
            var context = this;
            var args = arguments;

            window.clearTimeout(timer);
            timer = window.setTimeout(function () {
                fn.apply(context, args);
            }, delay);
        };
    }

    /* Безопасная работа с localStorage:
       приватный режим и повреждённый JSON не ломают страницу */
    function readStorage(key, fallback) {
        try {
            var raw = window.localStorage.getItem(key);

            if (!raw) {
                return fallback;
            }

            var parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {
                return parsed;
            }

            return fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeStorage(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            /* переполнение или приватный режим — игнорируем */
        }
    }

    /* Сумма в корзине */
    function getCartTotal(items) {
        return items.reduce(function (sum, item) {
            return sum + (Number(item.quantity) || 0);
        }, 0);
    }

    /* ========================================
       КАРТОЧКИ ТОВАРОВ
       На главной и в каталоге это .product-card,
       на странице новинок — .new-product-card,
       на странице популярного — .popular-product-card,
       на странице «Для дома» — .home-product-card.
       Селекторы собраны списком, чтобы избранное
       и корзина работали на всех страницах
       поверх одного и того же localStorage.
       ======================================== */

    var CARD = '.product-card, .new-product-card, .popular-product-card, .home-product-card';
    var FAVORITE_BUTTON = '.product-card__favorite, .new-product-card__favorite, .popular-product-card__favorite, .home-product-card__favorite';
    var CART_BUTTON = '.product-card__button, .new-product-card__button, .popular-product-card__button, .home-product-card__button';
    var CARD_LINK = '.product-card__link, .new-product-card__link, .popular-product-card__link, .home-product-card__link';
    var CARD_TITLE = '.product-card__title, .new-product-card__title, .popular-product-card__title, .home-product-card__title';
    var CARD_PRICE = '.product-card__price, .new-product-card__price, .popular-product-card__price, .home-product-card__price';
    var CARD_IMAGE = '.product-card__image, .new-product-card__image, .popular-product-card__image, .home-product-card__image';

    /* Стабильный ключ товара: ссылка на карточку.
       Она одинакова на всех страницах, поэтому
       избранное и корзина совпадают между ними */
    function getProductId(card, index) {
        var link = qs(CARD_LINK, card);
        var href = link && link.getAttribute('href');

        if (href) {
            return href.replace(/^.*[?#]/, '');
        }

        var explicit = card.getAttribute && card.getAttribute('data-id');

        if (explicit) {
            return explicit;
        }

        var section = card.closest ? card.closest('section') : null;
        var sectionKey = section && section.className ? section.className.split(' ')[0] : 'product';

        return sectionKey + '-' + index;
    }

    function getProductTitle(card) {
        var link = qs(CARD_LINK, card);
        var title = qs(CARD_TITLE, card);

        if (link && link.textContent.trim()) {
            return link.textContent.trim();
        }

        if (title) {
            return title.textContent.trim();
        }

        return 'Товар';
    }

    function getProductPrice(card) {
        var priceEl = qs(CARD_PRICE, card);

        if (!priceEl) {
            return 0;
        }

        var digits = priceEl.textContent.replace(/[^\d]/g, '');

        return digits ? Number(digits) : 0;
    }

    function getProductImage(card) {
        var img = qs(CARD_IMAGE, card);

        return img ? img.getAttribute('src') || '' : '';
    }

    /* ========================================
       STICKY HEADER
       Шапка фиксируется только после выхода из Hero.
       Никаких inline-стилей: только state-классы.
       ======================================== */

    function initStickyHeader() {
        var header = qs('.header');
        var hero = qs('.hero');

        if (!header) {
            return;
        }

        /* На страницах без Hero фиксируем шапку сразу —
           иначе она просто уехала бы вверх вместе со страницей */
        if (!hero) {
            header.classList.add('is-sticky');
            return;
        }

        var placeholder = document.createElement('div');
        placeholder.className = 'header-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.hidden = true;

        var placeholderHeight = 0;
        var stuck = false;
        var frame = null;

        function measure() {
            placeholderHeight = header.offsetHeight;
        }

        function setSticky(nextStuck) {
            if (nextStuck === stuck) {
                return;
            }

            stuck = nextStuck;

            if (stuck) {
                header.classList.add('is-sticky');
                placeholder.hidden = false;
                placeholder.style.height = placeholderHeight + 'px';
            } else {
                header.classList.remove('is-sticky');
                placeholder.hidden = true;
                placeholder.style.height = '';
            }
        }

        function evaluate() {
            frame = null;

            var heroBottom = hero.getBoundingClientRect().bottom;

            setSticky(heroBottom <= 0);
        }

        function onScroll() {
            if (frame === null) {
                frame = window.requestAnimationFrame(evaluate);
            }
        }

        function onResize() {
            if (stuck) {
                measure();
                placeholder.style.height = placeholderHeight + 'px';
            }

            evaluate();
        }

        measure();
        header.parentNode.insertBefore(placeholder, header.nextSibling);

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', debounce(onResize, 120));

        /* первоначальная оценка на случай загрузки с якоря */
        evaluate();
    }

    /* ========================================
       HERO SLIDER
       Работает с любым количеством .hero__image
       ======================================== */

    function initHeroSlider() {
        var hero = qs('.hero');

        if (!hero) {
            return;
        }

        var slides = qsa('.hero__image', hero);
        var counter = qs('.hero__slider-counter', hero);
        var prevBtn = qs('.hero__slider-button--prev', hero);
        var nextBtn = qs('.hero__slider-button--next', hero);

        if (slides.length === 0) {
            return;
        }

        var current = 0;
        var timer = null;

        slides.forEach(function (slide, index) {
            slide.classList.toggle('is-active', index === 0);
            slide.hidden = index !== 0;
        });

        function pad(value) {
            return String(value).padStart(2, '0');
        }

        function updateCounter() {
            if (!counter) {
                return;
            }

            counter.textContent = pad(current + 1) + ' / ' + pad(slides.length);
        }

        function goTo(index) {
            var next = (index + slides.length) % slides.length;

            if (next === current) {
                return;
            }

            slides[current].classList.remove('is-active');
            slides[current].hidden = true;

            current = next;

            slides[current].classList.add('is-active');
            slides[current].hidden = false;

            updateCounter();
        }

        function next() {
            goTo(current + 1);
        }

        function prev() {
            goTo(current - 1);
        }

        function startAutoplay() {
            if (prefersReducedMotion() || slides.length < 2 || timer) {
                return;
            }

            timer = window.setInterval(function () {
                if (!document.hidden) {
                    next();
                }
            }, HERO_AUTOPLAY_DELAY);
        }

        function stopAutoplay() {
            if (timer) {
                window.clearInterval(timer);
                timer = null;
            }
        }

        function restartAutoplay() {
            stopAutoplay();
            startAutoplay();
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                prev();
                restartAutoplay();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                next();
                restartAutoplay();
            });
        }

        hero.addEventListener('mouseenter', stopAutoplay);
        hero.addEventListener('mouseleave', startAutoplay);
        hero.addEventListener('focusin', stopAutoplay);
        hero.addEventListener('focusout', startAutoplay);

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                stopAutoplay();
            } else {
                startAutoplay();
            }
        });

        initSwipe(hero, prev, next);

        updateCounter();
        startAutoplay();
    }

    /* Общий touch/pointer-свайп.
       Вертикальное движение игнорируем, чтобы не мешать скроллу. */
    function initSwipe(element, onPrev, onNext) {
        if (!element) {
            return;
        }

        var startX = 0;
        var startY = 0;
        var tracking = false;

        function onPointerDown(event) {
            if (event.pointerType === 'mouse' && event.button !== 0) {
                return;
            }

            tracking = true;
            startX = event.clientX;
            startY = event.clientY;
        }

        function onPointerUp(event) {
            if (!tracking) {
                return;
            }

            tracking = false;

            var deltaX = event.clientX - startX;
            var deltaY = event.clientY - startY;

            if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
                return;
            }

            if (deltaX < 0) {
                onNext();
            } else {
                onPrev();
            }
        }

        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('pointerup', onPointerUp);
        element.addEventListener('pointercancel', function () {
            tracking = false;
        });
    }

    /* ========================================
       HORIZONTAL SCROLL SLIDER
       Используется в «Новинках»
       ======================================== */

    function createScrollSlider(list, prevBtn, nextBtn) {
        if (!list) {
            return null;
        }

        function step() {
            var firstItem = list.firstElementChild;

            if (!firstItem) {
                return Math.max(list.clientWidth * 0.8, 200);
            }

            var gap = parseFloat(window.getComputedStyle(list).columnGap || '0') || 0;

            return firstItem.getBoundingClientRect().width + gap;
        }

        function scrollByStep(direction) {
            var amount = step() * direction;

            list.scrollBy({
                left: amount,
                behavior: prefersReducedMotion() ? 'auto' : 'smooth'
            });
        }

        function updateState() {
            var maxScroll = list.scrollWidth - list.clientWidth;

            if (prevBtn) {
                prevBtn.disabled = list.scrollLeft <= 1;
            }

            if (nextBtn) {
                nextBtn.disabled = maxScroll <= 1 || list.scrollLeft >= maxScroll - 1;
            }
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                scrollByStep(-1);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                scrollByStep(1);
            });
        }

        list.addEventListener('scroll', function () {
            window.requestAnimationFrame(updateState);
        }, { passive: true });

        window.addEventListener('resize', debounce(updateState, 120));

        updateState();

        return { update: updateState };
    }

    function initNewArrivalsSlider() {
        var section = qs('.new-arrivals');

        if (!section) {
            return;
        }

        createScrollSlider(
            qs('.new-arrivals__list', section),
            qs('.new-arrivals__button--prev', section),
            qs('.new-arrivals__button--next', section)
        );
    }

    /* ========================================
       REVIEWS SLIDER
       ======================================== */

    function initReviewsSlider() {
        var section = qs('.reviews');

        if (!section) {
            return;
        }

        var list = qs('.reviews__list', section);
        var prevBtn = qs('.reviews__button--prev', section);
        var nextBtn = qs('.reviews__button--next', section);

        if (!list) {
            return;
        }

        var items = qsa('.reviews__item', list);

        if (items.length === 0) {
            if (prevBtn) { prevBtn.disabled = true; }
            if (nextBtn) { nextBtn.disabled = true; }
            return;
        }

        var index = 0;

        function perView() {
            if (window.matchMedia('(max-width: 767px)').matches) {
                return 1;
            }

            if (window.matchMedia('(max-width: 991px)').matches) {
                return 2;
            }

            return 3;
        }

        function maxIndex() {
            return Math.max(items.length - perView(), 0);
        }

        function update() {
            var max = maxIndex();

            index = clamp(index, 0, max);

            items.forEach(function (item, i) {
                item.classList.toggle('is-hidden', i < index || i >= index + perView());
            });

            if (prevBtn) {
                prevBtn.disabled = index <= 0;
            }

            if (nextBtn) {
                nextBtn.disabled = index >= max;
            }
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                index -= 1;
                update();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                index += 1;
                update();
            });
        }

        list.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowLeft') {
                index -= 1;
                update();
            }

            if (event.key === 'ArrowRight') {
                index += 1;
                update();
            }
        });

        initSwipe(
            list,
            function () { index -= 1; update(); },
            function () { index += 1; update(); }
        );

        window.addEventListener('resize', debounce(update, 120));

        update();
    }

    /* ========================================
       FAVORITES
       ======================================== */

    function initFavorites() {
        var buttons = qsa(FAVORITE_BUTTON);

        if (buttons.length === 0) {
            return;
        }

        var favorites = readStorage(STORAGE_FAVORITES, []);

        function isFavorite(id) {
            return favorites.indexOf(id) !== -1;
        }

        function save() {
            writeStorage(STORAGE_FAVORITES, favorites);
        }

        /* Состояние берём из массива избранного, а не из DOM:
           иначе после toggle атрибут не менялся и кнопка
           визуально оставалась прежней */
        function paint(button, active) {
            button.classList.toggle('is-active', Boolean(active));
            button.setAttribute('aria-pressed', active ? 'true' : 'false');

            var title = getProductTitle(button.closest(CARD));

            button.setAttribute(
                'aria-label',
                (active ? 'Убрать ' : 'Добавить ') + title + ' ' + (active ? 'из избранного' : 'в избранное')
            );
        }

        buttons.forEach(function (button, index) {
            var card = button.closest ? button.closest(CARD) : null;

            if (!card) {
                return;
            }

            var id = getProductId(card, index);

            paint(button, isFavorite(id));

            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                var position = favorites.indexOf(id);

                if (position === -1) {
                    favorites.push(id);
                } else {
                    favorites.splice(position, 1);
                }

                save();
                paint(button, position === -1);
            });
        });
    }

    /* ========================================
       CART
       ======================================== */

    function initCart() {
        var addButtons = qsa(CART_BUTTON);
        var counter = qs('.header__cart-count');

        var cart = readStorage(STORAGE_CART, []).filter(function (item) {
            return item && typeof item.id === 'string';
        });

        function save() {
            writeStorage(STORAGE_CART, cart);
            renderCounter();
        }

        function renderCounter() {
            if (!counter) {
                return;
            }

            var total = getCartTotal(cart);

            counter.textContent = String(total);
            counter.hidden = total === 0;
        }

        function addItem(id, title, price, image) {
            var existing = null;

            for (var i = 0; i < cart.length; i += 1) {
                if (cart[i].id === id) {
                    existing = cart[i];
                    break;
                }
            }

            if (existing) {
                existing.quantity = (Number(existing.quantity) || 0) + 1;
            } else {
                cart.push({
                    id: id,
                    title: title,
                    price: price,
                    image: image,
                    quantity: 1
                });
            }

            save();
        }

        addButtons.forEach(function (button, index) {
            var card = button.closest ? button.closest(CARD) : null;

            if (!card) {
                return;
            }

            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                addItem(
                    getProductId(card, index),
                    getProductTitle(card),
                    getProductPrice(card),
                    getProductImage(card)
                );

                flash(button);
            });
        });

        /* Клик по иконке корзины в шапке не должен мешать ссылке */
        renderCounter();
    }

    function flash(button) {
        var original = button.textContent;

        button.classList.add('is-added');
        button.textContent = 'Добавлено';
        button.disabled = true;

        window.setTimeout(function () {
            button.classList.remove('is-added');
            button.textContent = original;
            button.disabled = false;
        }, 1200);
    }

    /* ========================================
       HEADER BURGER
       ======================================== */

    function initHeaderMenu() {
        var header = qs('.header');

        if (!header) {
            return;
        }

        var burger = qs('.header__burger', header);
        var nav = qs('.header__nav', header);

        if (!burger || !nav) {
            return;
        }

        burger.addEventListener('click', function () {
            var expanded = burger.getAttribute('aria-expanded') === 'true';

            burger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            header.classList.toggle('is-menu-open', !expanded);
        });

        nav.addEventListener('click', function (event) {
            if (event.target && event.target.closest && event.target.closest('a')) {
                burger.setAttribute('aria-expanded', 'false');
                header.classList.remove('is-menu-open');
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && header.classList.contains('is-menu-open')) {
                burger.setAttribute('aria-expanded', 'false');
                header.classList.remove('is-menu-open');
            }
        });
    }

    /* ========================================
       SEARCH
       Полной разметки поиска в проекте нет —
       существующую ссылку не ломаем, но даём
       быстрый переход к полю, если оно появится.
       ======================================== */

    function initSearch() {
        var searchLink = qs('.header__search');
        var searchField = qs('[data-nord-search]');

        if (!searchLink || !searchField) {
            return;
        }

        searchLink.addEventListener('click', function (event) {
            event.preventDefault();

            searchField.hidden = false;
            searchField.focus();
        });
    }

    /* ========================================
       SMOOTH SCROLL
       Только для якорей. Обычные .html-ссылки
       остаются обычными переходами.
       ======================================== */

    function initSmoothScroll() {
        var anchors = qsa('a[href^="#"]').filter(function (anchor) {
            return anchor.getAttribute('href').length > 1;
        });

        if (anchors.length === 0) {
            return;
        }

        anchors.forEach(function (anchor) {
            anchor.addEventListener('click', function (event) {
                var id = anchor.getAttribute('href').slice(1);
                var target = document.getElementById(id);

                if (!target) {
                    return;
                }

                event.preventDefault();
                target.scrollIntoView({
                    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                    block: 'start'
                });
            });
        });
    }

    /* ========================================
       INIT
       ======================================== */

    function init() {
        initStickyHeader();
        initHeroSlider();
        initNewArrivalsSlider();
        initReviewsSlider();
        initFavorites();
        initCart();
        initHeaderMenu();
        initSearch();
        initSmoothScroll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
