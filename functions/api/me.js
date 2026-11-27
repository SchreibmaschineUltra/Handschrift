import { json } from "../../lib/access.js";
export const onRequestGet = ({ data }) => json({ owner: !!data.who.owner, name: data.who.link ? data.who.link.name : null });
