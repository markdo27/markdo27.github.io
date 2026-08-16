# markdo27.github.io

Landing page linking to live demos of my browser-based tools — a self-hosted
replacement for Linktree.

Live at **https://markdo27.github.io/**

## Structure

A single static `index.html`. No build step, no dependencies. GitHub Pages
serves it straight from `main`.

## Adding an app

Copy a card in the `Live demos` section and edit the `href`, name, description
and tag:

```html
<a class="card" href="https://markdo27.github.io/REPO/">
  <div class="card-top"><span class="card-idx">00</span><span class="card-name">NAME</span></div>
  <p class="card-desc">One line on what it does.</p>
  <div class="card-foot"><span class="tag">Type</span><span class="card-go">Open ↗</span></div>
</a>
```

For a demo link to work, the app's own repo needs GitHub Pages turned on
(Settings → Pages → deploy from `main`, folder `/`).

## Promoting a "Hosted elsewhere" app

Those cards point at GitHub source because the app needs a server or database.
Once it has a live URL, swap the `href` for that URL and change `Source ↗` to
`Open ↗`.

## Design

Follows the same light monospace system as
[circlefont](https://github.com/markdo27/circlefont): paper `#fafafa` on ink
`#0a0a0a`, IBM Plex Mono, hard 1px borders, no radius, no shadows. Cards invert
on hover.
