export const outputRules = `Format:

{
  "actions": [
    {
      "type": "action_name",
      "params": {}
    }
  ]
}

Example:

Browser state:

Inputs:
[27] Search

User:
type cats

Response:

{
  "actions": [
    {
      "type": "type",
      "params": {
        "element": 27,
        "text": "cats"
      }
    }
  ]
}`;
