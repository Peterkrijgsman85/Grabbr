'use strict';
const { normalizeRepository, selectLatestPublished, isSafeReleaseUrl, updateResult } = require('./update-check.js');

async function checkForUpdate(options={}) {
  const repository=normalizeRepository(options.repository);
  const currentVersion=options.currentVersion;
  const fetchImpl=options.fetchImpl;
  if(!repository)return{state:'error',message:'Updatecontrole is niet geconfigureerd voor deze bronbuild.'};
  if(typeof fetchImpl!=='function')return{state:'error',message:'Updatecontrole mislukt: netwerk-API niet beschikbaar.'};
  try{
    const response=await fetchImpl(`https://api.github.com/repos/${repository}/releases?per_page=20`,{headers:{Accept:'application/vnd.github+json','User-Agent':`Grabbr/${currentVersion}`,'X-GitHub-Api-Version':'2022-11-28'}});
    if(!response?.ok)throw new Error(`GitHub API gaf HTTP ${response?.status ?? 'onbekend'}.`);
    const releases=await response.json();
    const release=selectLatestPublished(releases,options.includePrereleases===true);
    const result=updateResult(currentVersion,release);
    if(result.url&&!isSafeReleaseUrl(result.url,repository))throw new Error('GitHub gaf een onveilige release-URL terug.');
    return result;
  }catch(error){return{state:'error',message:`Updatecontrole mislukt: ${error.message}`};}
}
module.exports={checkForUpdate};
