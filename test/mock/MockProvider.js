const crypto = require('crypto');

const BeachReportData = require('../../src/BeachReportData');

module.exports = class MockProvider extends BeachReportData {
  constructor(locationCount) {
    super();
    this.data = [];
    for(let i=0; i<locationCount; i++) {
      this.data.push({
        _source: {
          id: i,
          title: 'Location ' + i,
          grade_updated: (new Date(Date.now() - i*60*60*1000)).toString(),
          dry_grade: indexGrade(i),
          wet_grade: indexGrade(i),
          northSouthOrder: locationCount - i,
        },
      });
    }
  }
  // Overwrite to use fake data
  async fetch() {
    return this.data;
  }
}

function indexGrade(index) {
  const grades = 'ABCDF';
  const modifiers = '+-';
  const modifierInd = index % (modifiers.length + 1);
  return grades[index % grades.length]
    + (modifierInd === modifiers.length ? '' : modifiers[modifierInd]);
}
