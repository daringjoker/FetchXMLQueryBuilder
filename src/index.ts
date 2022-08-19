import { FetchXML } from '$/modules/queryBuilder';

async function hello(condition: boolean) {
  const query = new FetchXML()
    .table('msemr_appointmentemr')
    .select('*')
    .outerJoin('contact', 'contactid', 'msemr_actorpatient')
    .outerJoin(
      (q) =>
        q
          .table('msemr_healthcareservice')
          .select()
          .outerJoin(
            'msemr_healthcareservicecategory',
            'msemr_healthcareservicecategoryid',
            'smvs_healthcarecategory'
          ),
      'msemr_healthcareserviceid',
      'smvs_service'
    )
    .outerJoin('smvs_claim', 'smvs_appointmentid', 'activityid')
    .where('smvs_billable_status', 153940002);

  if (condition) {
    const fetchXML = await query.whereOrGroup((q) =>
      q.where('smvs_claim_generated', 153940001).where('smvs_claim_generated', 15394002)
    );

    console.log(fetchXML);
  } else {
    const fetchXML = await query.where('smvs_claim_generated', 153940001);

    console.log(fetchXML);
  }
}

(async () => {
  await hello(true);
  console.log('\n\n\n========================================\n\n\n');
  await hello(false);
})();
