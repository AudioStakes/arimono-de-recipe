# Support candidate and free input values

Recipe item inputs allow both predefined candidate values and free input values. We chose this because household recipe requests often include ingredients, tools, or preferences that are not in the prepared list, while candidates still make common requests fast to enter. The input model must keep the in-progress value separate from committed specified values, prevent duplicates, support candidate narrowing, and avoid treating Japanese IME composition as a committed value.
