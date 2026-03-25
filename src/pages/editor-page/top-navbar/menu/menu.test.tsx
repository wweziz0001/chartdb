import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Menu } from './menu';
import { useChartDB } from '@/hooks/use-chartdb';

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: vi.fn(),
}));

vi.mock('@/hooks/use-dialog', () => ({
    useDialog: () => ({
        openCreateDiagramDialog: vi.fn(),
        openOpenDiagramDialog: vi.fn(),
        openSaveDiagramDialog: vi.fn(),
        openExportSQLDialog: vi.fn(),
        openImportDatabaseDialog: vi.fn(),
        openExportImageDialog: vi.fn(),
        openExportDiagramDialog: vi.fn(),
        openImportDiagramDialog: vi.fn(),
        openExportBackupDialog: vi.fn(),
        openImportBackupDialog: vi.fn(),
    }),
}));

vi.mock('@/hooks/use-export-image', () => ({
    useExportImage: () => ({
        exportImage: vi.fn(),
    }),
}));

vi.mock('@/hooks/use-history', () => ({
    useHistory: () => ({
        redo: vi.fn(),
        undo: vi.fn(),
        hasRedo: false,
        hasUndo: false,
    }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/hooks/use-layout', () => ({
    useLayout: () => ({
        hideSidePanel: vi.fn(),
        isSidePanelShowed: true,
        showSidePanel: vi.fn(),
    }),
}));

vi.mock('@/hooks/use-theme', () => ({
    useTheme: () => ({
        setTheme: vi.fn(),
        theme: 'light',
    }),
}));

vi.mock('@/hooks/use-local-config', () => ({
    useLocalConfig: () => ({
        scrollAction: 'zoom',
        setScrollAction: vi.fn(),
        setShowCardinality: vi.fn(),
        showCardinality: true,
        setShowFieldAttributes: vi.fn(),
        showFieldAttributes: true,
        setShowMiniMapOnCanvas: vi.fn(),
        showMiniMapOnCanvas: true,
        showDBViews: true,
        setShowDBViews: vi.fn(),
    }),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
}));

vi.mock('@/context/alert-context/alert-context', () => ({
    useAlert: () => ({
        showAlert: vi.fn(),
    }),
}));

const mockedUseChartDB = vi.mocked(useChartDB);

describe('editor menu readonly behavior', () => {
    beforeEach(() => {
        mockedUseChartDB.mockReset();
    });

    it('disables save and mutation menu items for viewers', async () => {
        const user = userEvent.setup();

        mockedUseChartDB.mockReturnValue({
            clearDiagramData: vi.fn(),
            deleteDiagram: vi.fn(),
            saveDiagram: vi.fn(),
            databaseType: 'postgresql',
            readonly: true,
        } as never);

        render(<Menu />);

        await user.click(screen.getByText('menu.actions.actions'));

        expect(
            screen.getByRole('menuitem', {
                name: 'menu.actions.save Ctrl+S',
            })
        ).toHaveAttribute('data-disabled');
        expect(
            screen.getByRole('menuitem', { name: 'menu.actions.save_as' })
        ).toHaveAttribute('data-disabled');
        expect(
            screen.getByRole('menuitem', {
                name: 'menu.actions.delete_diagram',
            })
        ).toHaveAttribute('data-disabled');
    });
});
