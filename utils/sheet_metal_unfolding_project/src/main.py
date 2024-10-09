import os
from file_loader import load_step_file  # Assuming file_loader is refactored
from sheet_tree import SheetTree  # Assuming sheet_tree is refactored
from export_handler import export_unfolded  # Handle export functionality
def process_unfold(step_file_path):
    try:
        # Step 1: Load the STEP file
        shape = load_step_file(step_file_path)
        if shape is None:
            print("Error loading the STEP file.")
            return
        # Step 2: Build the sheet tree for analysis
        sheet_tree = SheetTree(shape)
        sheet_tree.build_tree()  # Build the tree and detect bends
        
        # Step 3: Perform the unfolding operation (Bend analysis and flattening)
        sheet_tree.unfold()  # Initiate the unfolding process
        
        # Step 4: Export the unfolded result
        export_path = os.path.join(os.getcwd(), "unfolded_result.step")
        export_unfolded(sheet_tree, export_path)  # Assuming export_unfolded saves the result

        print(f"Unfolding process completed! Output saved to: {export_path}")

    except Exception as e:
        print(f"An error occurred during unfolding: {str(e)}")

if __name__ == "__main__":
    step_file = "data/WP-2.step"  # Update with the correct STEP file
    process_unfold(step_file)
