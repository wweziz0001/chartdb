import React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/dropdown-menu/dropdown-menu';
import { Button } from '@/components/button/button';
import {
    Ellipsis,
    PencilLine,
    Share2,
    SquareArrowOutUpRight,
    Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DiagramRowActionsMenuProps {
    onOpen: () => void;
    onShare: () => void;
    onRename: () => void;
    onDelete: () => void;
    canShare?: boolean;
    canRename?: boolean;
    canDelete?: boolean;
}

export const DiagramRowActionsMenu: React.FC<DiagramRowActionsMenuProps> = ({
    onOpen,
    onShare,
    onRename,
    onDelete,
    canShare = true,
    canRename = true,
    canDelete = true,
}) => {
    const { t } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Ellipsis className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={onOpen}
                    className="flex justify-between gap-4"
                >
                    {t('open_diagram_dialog.diagram_actions.open')}
                    <SquareArrowOutUpRight className="size-3.5" />
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={onShare}
                    disabled={!canShare}
                    className="flex justify-between gap-4"
                >
                    {t('open_diagram_dialog.sharing.share_diagram')}
                    <Share2 className="size-3.5" />
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={onRename}
                    disabled={!canRename}
                    className="flex justify-between gap-4"
                >
                    {t('open_diagram_dialog.diagram_actions.rename')}
                    <PencilLine className="size-3.5" />
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={onDelete}
                    disabled={!canDelete}
                    className="flex justify-between gap-4 text-red-700"
                >
                    {t('open_diagram_dialog.diagram_actions.delete')}
                    <Trash2 className="size-3.5 text-red-700" />
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
