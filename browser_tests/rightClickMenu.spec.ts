import { expect } from '@playwright/test';
import { comfyPageFixture as test } from './ComfyPage';

test.describe('Canvas Right Click Menu', () => {
    // See https://github.com/comfyanonymous/ComfyUI/issues/3883
    // Right-click menu on canvas's option sequence is not stable.
    test.skip('Can add node', async ({ comfyPage }) => {
        await comfyPage.rightClickCanvas();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-menu.png');
        await comfyPage.page.getByText('Add Node').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('add-node-menu.png');
        await comfyPage.page.getByText('loaders').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('add-node-menu-loaders.png');
        await comfyPage.page.getByText('Load VAE').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('add-node-node-added.png');
    });

    // See https://github.com/comfyanonymous/ComfyUI/issues/3883
    // Right-click menu on canvas's option sequence is not stable.
    test.skip('Can add group', async ({ comfyPage }) => {
        await comfyPage.rightClickCanvas();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-menu.png');
        await comfyPage.page.getByText('Add Group', { exact: true }).click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('add-group-group-added.png');
    });

    test('Can convert to group node', async ({ comfyPage }) => {
        await comfyPage.select2Nodes();
        await expect(comfyPage.canvas).toHaveScreenshot('selected-2-nodes.png');
        comfyPage.page.on('dialog', async dialog => {
            await dialog.accept("GroupNode2CLIP");
        });
        await comfyPage.rightClickCanvas();
        await comfyPage.page.getByText('Convert to Group Node').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node-group-node.png');
    });
});

test.describe('Node Right Click Menu', () => {
    test('Can open properties panel', async ({ comfyPage }) => {
        await comfyPage.rightClickEmptyLatentNode();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png');
        await comfyPage.page.getByText('Properties Panel').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node-properties-panel.png');
    });

    test('Can collapse', async ({ comfyPage }) => {
        await comfyPage.rightClickEmptyLatentNode();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png');
        await comfyPage.page.getByText('Collapse').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node-collapsed.png');
    });

    test('Can bypass', async ({ comfyPage }) => {
        await comfyPage.rightClickEmptyLatentNode();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png');
        await comfyPage.page.getByText('Bypass').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node-bypassed.png');
    });

    test('Can convert widget to input', async ({ comfyPage }) => {
        await comfyPage.rightClickEmptyLatentNode();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png');
        await comfyPage.page.getByText('Convert Widget to Input').click();
        await comfyPage.nextFrame();
        await comfyPage.page.getByText('Convert width to input').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node-widget-converted.png');
    });
});
