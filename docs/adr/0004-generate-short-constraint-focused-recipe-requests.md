# Generate short constraint-focused recipe requests

The app generates short recipe request text that strongly reflects the user's specified recipe request and omits unspecified items. We chose this because the output is meant to be copied into an AI chat, where extra instructions can make the answer longer or less focused. The request should emphasize available ingredients, requested dish type, tools, time limits, NG ingredients or seasonings, and pairing context only when those values are specified.
