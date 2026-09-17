const NAME_KEY = "livepulse_voter_name";

export function getVoterName() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function saveVoterName(name) {
  localStorage.setItem(NAME_KEY, name.trim());
}