import assert from 'node:assert/strict';import {visibleControls,canManageProfile} from './web/access.js';
const screens=['ApplicationCenter','AuthorityCenter','UserAnalyticsCenter','FinanceCenter','GiftCatalog','BanCenter'].map(id=>[id,id,null]);
assert.equal(visibleControls(screens,{is_founder:true}).length,6);
assert.deepEqual(visibleControls(screens,{permissions:['users.view']}).map(x=>x[0]),['ApplicationCenter','UserAnalyticsCenter']);
assert.deepEqual(visibleControls(screens,{permissions:['roles.assign']}).map(x=>x[0]),['ApplicationCenter','AuthorityCenter']);
assert.equal(canManageProfile({permissions:[]}),false);assert.equal(canManageProfile({permissions:['users.view']}),true);console.log('PASS: staff selectors reflect actual server permissions; Founder retains all original controls');
