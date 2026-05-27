# Keep recipe items small and domain-oriented

Recipe items should remain few and domain-oriented, rather than mirroring every possible recipe-search filter as a separate field. We combine taste, cuisine genre, nutrition, and scene into `レシピの方向性`, while keeping `調理時間` and `作りやすさ` separate, so the form stays lightweight without losing important request details. Visible labels should follow `CONTEXT.md`, and additional preferences should stay behind `こだわり項目` instead of expanding the initial form.
