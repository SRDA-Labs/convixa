/**
 * Ledger Wallet Provider ships Tailwind v4-compiled CSS that uses standard
 * CSS cascade `@layer base|components|utilities`. Our Tailwind v3 PostCSS
 * plugin hijacks those layer names and fails the build unless matching
 * `@tailwind` directives exist in the same file.
 *
 * Rename those layers so Tailwind v3 leaves the precompiled CSS alone.
 */
module.exports = function ledgerCssLayerFixLoader(source) {
  return source
    .replace(/@layer\s+base\b/g, "@layer ledger-base")
    .replace(/@layer\s+components\b/g, "@layer ledger-components")
    .replace(/@layer\s+utilities\b/g, "@layer ledger-utilities");
};
