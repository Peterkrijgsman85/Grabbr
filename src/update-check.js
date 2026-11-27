'use strict';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

function parseSemver(value) {
  const match = String(value || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ? match[4].split('.') : [] };
}
function compareIdentifiers(a,b){const an=/^\d+$/.test(a),bn=/^\d+$/.test(b);if(an&&bn)return Number(a)-Number(b);if(an!==bn)return an?-1:1;return a.localeCompare(b);}
function compareSemver(a,b){const left=parseSemver(a),right=parseSemver(b);if(!left||!right)throw new TypeError('Ongeldige semver.');for(const key of ['major','minor','patch'])if(left[key]!==right[key])return left[key]-right[key];if(!left.prerelease.length&&!right.prerelease.length)return 0;if(!left.prerelease.length)return 1;if(!right.prerelease.length)return-1;for(let i=0;i<Math.max(left.prerelease.length,right.prerelease.length);i++){if(left.prerelease[i]===undefined)return-1;if(right.prerelease[i]===undefined)return 1;const c=compareIdentifiers(left.prerelease[i],right.prerelease[i]);if(c)return c;}return 0;}
function selectLatestPublished(releases,includePrereleases=false){return (Array.isArray(releases)?releases:[]).filter(r=>r&&!r.draft&&(includePrereleases||!r.prerelease)&&parseSemver(r.tag_name)).sort((a,b)=>compareSemver(b.tag_name,a.tag_name))[0]||null;}
function isCheckDue(lastCheckedAt,now=Date.now(),interval=CHECK_INTERVAL_MS){const previous=Date.parse(lastCheckedAt||'');return !Number.isFinite(previous)||now-previous>=interval;}
function normalizeRepository(value){const repo=String(value||'').trim();return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)?repo:null;}
function isSafeReleaseUrl(url,repository){try{const parsed=new URL(url);const repo=normalizeRepository(repository);if(!repo||parsed.protocol!=='https:'||parsed.hostname!=='github.com')return false;const prefix=`/${repo.toLowerCase()}/releases/`;return parsed.pathname.toLowerCase().startsWith(prefix);}catch{return false;}}
function isSafeRepositoryUrl(url,repository){try{const parsed=new URL(url);const repo=normalizeRepository(repository);if(!repo||parsed.protocol!=='https:'||parsed.hostname!=='github.com')return false;return parsed.pathname.replace(/\/+$/,'').toLowerCase()===`/${repo.toLowerCase()}`;}catch{return false;}}
function updateResult(currentVersion,release){if(!release)return{state:'none',message:'Geen gepubliceerde release gevonden.'};const newer=compareSemver(release.tag_name,currentVersion)>0;return newer?{state:'available',version:String(release.tag_name).replace(/^v/,''),url:release.html_url,message:`Grabbr ${String(release.tag_name).replace(/^v/,'')} is beschikbaar.`}:{state:'current',version:String(currentVersion),message:'Grabbr is up-to-date.'};}
module.exports={CHECK_INTERVAL_MS,parseSemver,compareSemver,selectLatestPublished,isCheckDue,normalizeRepository,isSafeReleaseUrl,isSafeRepositoryUrl,updateResult};
