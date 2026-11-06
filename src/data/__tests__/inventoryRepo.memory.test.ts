import { createMemoryRepos } from '../memory/createMemoryRepos';
import { runInventoryContract } from '../contract/inventoryRepo.contract';

runInventoryContract(() => createMemoryRepos());
