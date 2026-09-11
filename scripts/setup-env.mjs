import { copyFileSync, constants, existsSync } from 'node:fs';
for (const app of ['api', 'web']) {
  const target = `apps/${app}/.env`;
  if (!existsSync(target)) copyFileSync(`${target}.example`, target, constants.COPYFILE_EXCL);
  console.log(`${target}: ready (existing values preserved)`);
}
