import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramName } from './diagram-name';
import { useChartDB } from '@/hooks/use-chartdb';
import { TooltipProvider } from '@/components/tooltip/tooltip';

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: vi.fn(),
}));

vi.mock('@/hooks/use-dialog', () => ({
    useDialog: () => ({
        openOpenDiagramDialog: vi.fn(),
    }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('react-use', () => ({
    useClickAway: vi.fn(),
    useKeyPressEvent: vi.fn(),
}));

const mockedUseChartDB = vi.mocked(useChartDB);

describe('diagram name readonly behavior', () => {
    beforeEach(() => {
        mockedUseChartDB.mockReset();
    });

    it('shows a view-only badge and blocks inline renaming for viewers', () => {
        mockedUseChartDB.mockReturnValue({
            diagramName: 'Shared Diagram',
            updateDiagramName: vi.fn(),
            currentDiagram: {
                id: 'diagram-1',
                name: 'Shared Diagram',
                databaseType: 'postgresql',
                databaseEdition: null,
            },
            diagramSession: undefined,
            readonly: true,
        } as never);

        render(
            <TooltipProvider>
                <DiagramName />
            </TooltipProvider>
        );

        expect(screen.getByText('View only')).toBeInTheDocument();

        fireEvent.doubleClick(screen.getByText('Shared Diagram'));

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('still allows inline renaming for editors', () => {
        mockedUseChartDB.mockReturnValue({
            diagramName: 'Editable Diagram',
            updateDiagramName: vi.fn(),
            currentDiagram: {
                id: 'diagram-2',
                name: 'Editable Diagram',
                databaseType: 'postgresql',
                databaseEdition: null,
            },
            diagramSession: undefined,
            readonly: false,
        } as never);

        render(
            <TooltipProvider>
                <DiagramName />
            </TooltipProvider>
        );

        fireEvent.doubleClick(screen.getByText('Editable Diagram'));

        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(screen.queryByText('View only')).not.toBeInTheDocument();
    });
});
