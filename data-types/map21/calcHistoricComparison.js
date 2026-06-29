/**
 * Mutates passed-in verificationResult. Gated off by default — historic
 * comparison only runs when pm3Config.COMPARE_AGAINST_HISTORIC is true.
 */
function calcHistoricComparison({ tmcResult, curTmcId, verificationResult, METRIC_NAMES }) {
  METRIC_NAMES.forEach((mName) => {
    if (!verificationResult[mName]) {
      verificationResult[mName] = { total: 0, numFail: 0, failTmcIds: [] };
    }
    const verificationData = tmcResult[mName]?.verifyResult;
    if (!verificationData) return;

    verificationResult[mName].total++;
    let didPass = true;
    Object.keys(verificationData).forEach((field) => {
      if (!verificationResult[mName][field]) {
        verificationResult[mName][field] = { totalDelta: 0, totalAbsDelta: 0, count: 0, tmcs: [] };
      }
      if (verificationData[field].match === false) {
        if (!isNaN(verificationData[field]?.delta) && !isNaN(verificationData[field]?.absDelta)) {
          verificationResult[mName][field].totalDelta += verificationData[field].delta;
          verificationResult[mName][field].totalAbsDelta += verificationData[field].absDelta;
        }
        verificationResult[mName][field].count++;
        verificationResult[mName][field].tmcs.push(curTmcId);
        didPass = false;
      }
    });
    if (!didPass) {
      verificationResult[mName].numFail++;
      verificationResult[mName].failTmcIds.push(curTmcId);
    }
  });
}

module.exports = { calcHistoricComparison };
